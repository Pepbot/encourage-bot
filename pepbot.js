/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _'-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

const Botkit = require('botkit');
const os = require('os');
const moment = require('moment');
// Botkit-based Redis store
const Redis = require('./redis_storage.js');
const formatUptime = require('./functions/format_uptime.js');
const getAdminUsers = require('./functions/get_admin_users.js');
const getUsername = require('./functions/get_username.js');
const getEncouragement = require('./functions/get_encouragement.js');

const redisURL = 'redis://h:pea00b467cde6d2e40b066669800b42275e206224ecd873f08af3ef3e65e08a32@ec2-34-194-51-203.compute-1.amazonaws.com:28839';
const RedisStore = new Redis({ url: redisURL });
const port = process.env.PORT || process.env.port;

// Programmatically use appropriate process environment variables
try {
  require('./env.js');
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('Not using environment variables from env.js');
  }
}

// Taken from howdya botkit tutorial
if (!process.env.clientId || !process.env.clientSecret || !port) {
  console.log('Error: Specify clientId clientSecret redirectUri and port in environment');
}

const controller = Botkit.slackbot({
  storage: RedisStore,
  // rtm_receive_messages: false, // disable rtm_receive_messages if you enable events api
}).configureSlackApp({
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
  redirectUri: process.env.redirectUri, // optional parameter passed to slackbutton oauth flow
  scopes: ['bot'],
});

controller.setupWebserver(port, (err, webserver) => {
  webserver.get('/', (req, res) => {
    res.sendFile(`${__dirname}/public/index.html`);
  });
  controller.createWebhookEndpoints(controller.webserver);
  controller.createOauthEndpoints(controller.webserver, (e, req, res) => {
    if (e) {
      res.status(500).send(`ERROR: ${e}`);
    } else {
      res.send('Success!');
    }
  });
});

// To make sure we don't connect to the RTM twice for the same team
const _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

controller.on('create_bot', (bot, config) => {
  if (_bots[bot.config.token]) {
    console.log('bot appears to already be online');
    // already online! do nothing.
  } else {
    console.log('starting RTM...');
    bot.startRTM((err) => {
      if (!err) {
        console.log('successfully started RTM');
        trackBot(bot);
      }
      bot.startPrivateConversation({ user: config.createdBy }, (error, convo) => {
        if (error) {
          console.log(error);
        } else {
          convo.say('I am a bot that has just joined your team');  // TODO: use better message
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });
    });
  }
});

// Handle events related to the websocket connection to Slack
controller.on('rtm_open', () => {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close', () => {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});

function sendAdminMessage(adminUsers, message) {
  for (let i = 0; i < adminUsers.length; i + 1) {
    const user = adminUsers[i];
    bot.api.im.open({
      user: user.id,
    }, (err, res) => {
      if (err) {
        bot.botkit.log('Failed to open IM with user', err);
      }
      bot.startConversation({
        user: user.id,
        channel: res.channel.id,
      }, (convo) => {
        convo.say(`Just so you know, <@${message.user}> flagged a message as inappropriate. Please investigate.`);
      });
    });
  }
}

function sendFlaggedMessageToAdmin(bot, message) {
  // var adminUsers = when(getAdminUsers).then(function(message) {
  //     sendAdminMessage(adminUsers, message);
  // }).catch(console.error);
  getAdminUsers()
  .then((result) => {
    sendAdminMessage(result, message);
  }).catch((err) => {
    console.log(err);
  });

  // setTimeout(() => { sendAdminMessage(adminUsers, message); }, 1000);
}

controller.hears(['flag'], 'direct_message', (bot, message) => {
  sendFlaggedMessageToAdmin(bot, message);
  bot.reply(message, 'I\'ll notify the team\'s admin that the last message was inappropriate.');
});

function sendMondayMessage(bot, username, recipient) {
  bot.api.im.open({
    user: username.id,
  }, (err, res) => {
    if (err) {
      bot.botkit.log('Failed to open IM with user', err);
    }
    bot.startConversation({
      user: username,
      channel: res.channel.id,
    }, (error, convo) => {
      convo.say(`Please pep up ${recipient} with positive feedback for the week \n Type 'tell @${recipient}' and a message to send your peppy message anonymously`);
    });
  });
}

// Loops through the users in the team,
// for each user calls the sendMondayMessage function to determine the recipient
function findUserAndRecipient(bot) {
    // controller.hears(['test'], 'direct_message', function(bot, message) {
  bot.api.users.list({}, (err, response) => {
    if (response.hasOwnProperty('members') && response.ok) {
      const members = [];
      response.members.forEach((member) => {
        if (!member.is_bot) {
          members.push(member);
        }
      });
      const weekNumber = moment('11-15-2016', 'MM-DD-YYYY').week();
      const counter = weekNumber % members.length;
      for (let i = 0; i < members.length; i + 1) {
        const username = members[i];
        const counter2 = (i + counter) % members.length;
        const recipient = members[counter2].name;
        sendMondayMessage(bot, username, recipient);
      }
    }
  });
}

controller.hears(['test'], 'direct_message', (bot) => {
  findUserAndRecipient(bot);
});

function sendEncouragement(bot, username, encouragement) {
  bot.api.im.open({
    user: username,
  }, (err, res) => {
    if (err) {
      bot.botkit.log('Failed to open IM with user', err);
    }
    bot.startConversation({
      user: username,
      channel: res.channel.id,
    }, (error, convo) => {
      convo.say(encouragement);
    });
  });
}

controller.hears(['tell @*'], 'direct_message', (bot, message) => {
  const username = getUsername(message.text);
  const encouragement = getEncouragement(message.text);
  sendEncouragement(bot, username, encouragement);
});

controller.hears(['pepper'], 'direct_message,direct_mention,ambient', (bot, message) => {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'hot_pepper',
  }, (err) => {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });
  bot.reply(message, 'That\'s my name!!');
});

controller.hears(['help'], 'direct_message,direct_mention,ambient', (bot, message) => {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'hatched_chick',
  });
  bot.reply(message, {
    attachments: [
      {
        fallback: 'Required plain-text summary of the attachment.',
        pretext: 'Need some help? Here’s what I do:\n\nSend You Reminders: I’ll send you a message here reminding you to send some encouragement to one of your team mates each week. Like this:',
        text: `Hi <@${message.user}>! Send @[recipient name] some encouragement to pep up their day! :hot_pepper:`,
      },
      {
        fallback: 'Required plain-text summary of the attachment.',
        pretext: 'Deliver Your Messages: Let me know who to send the message to by typing ‘tell’ followed by the name of your team mate. Like this:',
        text: 'tell @name You did an awesome job this morning! :raised_hands:',
      },
      {
        fallback: 'Summary',
        pretext: 'Keep It Positive: Report any abusive comments by replying with the word ‘flag’.:triangular_flag_on_post:',
      }],
  });
});

controller.hears(['party'], 'direct_message,direct_mention,ambient', (bot, message) => {
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
  bot.reply(message, 'It\'s party time!!!!!');
});

controller.hears(['hello', 'hi', 'hey', 'yo'], 'direct_message,direct_mention,mention', (bot, message) => {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  }, (err) => {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });
  controller.storage.users.get(message.user, (err, user) => {
    if (user && user.name) {
      bot.reply(message, `Hello ${user.name}!!`);
    } else {
      bot.reply(message, 'Hiya :)');
    }
  });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', (bot, message) => {
  const name = message.match[1];
  controller.storage.users.get(message.user, (err, user) => {
    let currentUser = user;
    if (!currentUser) {
      currentUser = {
        id: message.currentUser,
      };
    }
    currentUser.name = name;
    controller.storage.users.save(currentUser, () => {
      bot.reply(message, `Got it. I will call you ${currentUser.name} from now on.`);
    });
  });
});

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
  'direct_message,direct_mention,mention', (bot, message) => {
    const hostname = os.hostname();
    const uptime = formatUptime(process.uptime());
    bot.reply(message, `:robot_face: I am a bot named <@${bot.identity.name}>. I have been running for ${uptime} on ${hostname}.`);
  });
