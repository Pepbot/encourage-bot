/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js

# USE THE BOT:

  Find your bot inside Slack to send it a direct message.

  Say: "Hello"

  The bot will reply "Hello!"

  Say: "who are you?"

  The bot will tell you its name, where it is running, and for how long.

  Say: "Call me <nickname>"

  Tell the bot your nickname. Now you are friends.

  Say: "who am I?"

  The bot will tell you your nickname, if it knows one for you.

  Say: "shutdown"

  The bot will ask if you are sure, and then shut itself down.

  Make sure to invite your bot into other channels using /invite @<my bot>!

# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var Botkit = require('botkit');
var schedule = require('node-schedule');
var os = require('os');
var when = require('when');
var moment = require('moment');
//const express     = require("express");
//const app         = express();

// Botkit-based Redis store
var Redis_Store = require('./redis_storage.js');
var redis_url = "redis://h:pea00b467cde6d2e40b066669800b42275e206224ecd873f08af3ef3e65e08a32@ec2-34-194-51-203.compute-1.amazonaws.com:28839";
var redis_store = new Redis_Store({url: redis_url});

// Programmatically use appropriate process environment variables
 try {
   require('./env.js');
 } catch (e) {
   if (e.code === 'MODULE_NOT_FOUND') {
     console.log('Not using environment variables from env.js');
   }
 }

 var port = process.env.PORT || process.env.port;

// if (!process.env.token) {
//     console.log('Error: Specify token in environment');
//     process.exit(1);
// }

// Taken from howdya botkit tutorial
if (!process.env.clientId || !process.env.clientSecret || !port) {
  console.log('Error: Specify clientId clientSecret redirectUri and port in environment');
  //process.exit(1);
}

var controller = Botkit.slackbot({
  storage: redis_store,
  // rtm_receive_messages: false, // disable rtm_receive_messages if you enable events api
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    redirectUri: process.env.redirectUri, // optional parameter passed to slackbutton oauth flow
    scopes: ['bot'],
  }
);
console.log("JUST FINISHED SETTING UP REDIS");
controller.setupWebserver(port,function(err,webserver) {
    console.log("SETTING UP WEBSERVER");

  webserver.get('/',function(req,res) {
    res.sendFile(__dirname + '/index.html');
  });

controller.createWebhookEndpoints(controller.webserver);

controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    console.log("INSIDE OAUTH ENDPOINT CODE");
    if (err) {
        console.log("ERRORRRR");
        res.status(500).send('ERROR: ' + err);
    } else {
        console.log("SHOULD HAVE SUCCEEDED");
        res.send('Success!');
    }
  });
});


// To make sure we don't connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

controller.on('create_bot',function(bot,config) {
  console.log("create bot...");
  if (_bots[bot.config.token]) {
    console.log("bot appears to already be online");
    // already online! do nothing.
  } else {
    console.log("starting RTM...");
    bot.startRTM(function(err) {

      if (!err) {
        console.log("successfully started RTM");
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('I am a bot that has just joined your team');  //TODO: use better message
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });

    });
  }

});


// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});

controller.hears(['flag'], 'direct_message', function(bot, message) {
    sendFlaggedMessageToAdmin(bot, message);
    bot.reply(message, "I'll notify the team's admin that the last message was inappropriate.");
});

function getAdminUsers() {
    var admin_users = [];
    bot.api.users.list({}, function (err, response) {
       if (response.hasOwnProperty('members') && response.ok) {
           var members = response.members;
           for (var i = 0; i < members.length; i++) {
                if (members[i].is_admin) {
                    admin_users.push(members[i]);
                }
            }

       }
   });
  return admin_users;
}

function sendFlaggedMessageToAdmin(bot, message) {
    // var admin_users = when(getAdminUsers).then(function(message) {
    //     sendAdminMessage(admin_users, message);
    // }).catch(console.error);

    var admin_users = getAdminUsers();
    setTimeout(function(){ sendAdminMessage(admin_users, message)},1000);
}

function sendAdminMessage(admin_users, message) {
    for (var i = 0; i < admin_users.length; i++) {
        var user = admin_users[i];
        bot.api.im.open({
            user: user.id
        }, (err, res) => {
            if (err) {
                bot.botkit.log('Failed to open IM with user', err)
            }
            console.log(res);
            bot.startConversation({
                user: user.id,
                channel: res.channel.id,
            }, (err, convo) => {
                convo.say("Just so you know, <@" + message.user + "> flagged a message as inappropriate. Please investigate.");
            });
        })
    }
}

controller.hears(['test'], 'direct_message', function(bot, message) {
   findUserAndRecipient(bot);
});

// Loops through the users in the team, for each user calls the sendMondayMessage function to determine the recipient
function findUserAndRecipient(bot) {
    // controller.hears(['test'], 'direct_message', function(bot, message) {
        bot.api.users.list({}, function (err, response) {
            if (response.hasOwnProperty('members') && response.ok) {
                var members = []
                response.members.forEach(function(member) {
                    if (!member.is_bot) {
                        members.push(member);
                    }
                })
                // console.log(members);

                var weekNumber = moment("11-15-2016", "MM-DD-YYYY").week();
                var counter = weekNumber % members.length;
                console.log(counter);
                for (var i = 0; i < members.length; i++) {
                    var username = members[i];
                    var counter2 = (i + counter) % members.length;
                    var recipient = members[counter2].name;
                    // console.log(username, recipient);
                    sendMondayMessage(bot, username, recipient)
                }
            }
        });
    // });
}


function sendMondayMessage(bot, username, recipient) {
   bot.api.im.open({
        user: username.id
    }, (err, res) => {
        if (err) {
            bot.botkit.log('Failed to open IM with user', err)
        }
        bot.startConversation({
            user: username,
            channel: res.channel.id,
        }, (err, convo) => {
            convo.say("Please pep up " + recipient + " with positive feedback for the week \n Type \'tell @" + recipient + "\' and a message to send your peppy message annonymously ");
            // convo.say("Type \'tell @" + recipient + "\' and a message to send your peppy message annonymously ");
        });
    });
}

function sendEncouragement(bot, username, encouragement) {
   bot.api.im.open({
        user: username
    }, (err, res) => {
        if (err) {
            bot.botkit.log('Failed to open IM with user', err)
        }
        console.log(res);
        bot.startConversation({
            user: username,
            channel: res.channel.id,
        }, (err, convo) => {
            convo.say(encouragement);
        });
    })
}

controller.hears(['tell @*'], 'direct_message', function(bot, message) {
    var username = getUsername(message.text);
    var encouragement = getEncouragement(message.text);
    sendEncouragement(bot, username, encouragement);
});

function getUsername(message) {
    var arr = message.split(" ");
    var username = arr[1];
    username = username.toString();
    username = username.replace('@', '');
    username = username.replace('<', '');
    username = username.replace('>', '');
    return username;
}

function getEncouragement(encouragement) {
    var arr = encouragement.split(" ");
    arr.splice(0, 2);
    return arr.join(' ');
}

controller.hears(['pepper'], 'direct_message,direct_mention,ambient', function(bot, message) {
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'hot_pepper',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });
    bot.reply(message, "That's my name!!");
});

controller.hears(['help'], 'direct_message,direct_mention,ambient', function(bot, message) {
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'hatched_chick',
    });
    bot.reply(message, {
    "attachments": [
        {
            "fallback": "Required plain-text summary of the attachment.",
            "pretext": "Need some help? Here’s what I do:\n\nSend You Reminders: I’ll send you a message here reminding you to send some encouragement to one of your team mates each week. Like this:",
            "text": "Hi <@" + message.user + ">! Send @[recipient name] some encouragement to pep up their day! :hot_pepper:",
        },
        {
            "fallback": "Required plain-text summary of the attachment.",
            "pretext": "Deliver Your Messages: Let me know who to send the message to by typing ‘tell’ followed by the name of your team mate. Like this:",
            "text": "tell @name You did an awesome job this morning! :raised_hands:",
        },
        {
            "fallback": "Summary",
            "pretext": "Keep It Positive: Report any abusive comments by replying with the word ‘flag’.:triangular_flag_on_post:"
        }
    ]
    });
});

controller.hears(['party'], 'direct_message,direct_mention,ambient', function(bot, message) {
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'hot_pepper',
    });
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'ghost',
    });
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'confetti_ball',
    });
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'birthday',
    });
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'lollipop',
    });
    bot.reply(message, "It's party time!!!!!");
});

controller.hears(['hello', 'hi', 'hey', 'yo'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hiya :)');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
