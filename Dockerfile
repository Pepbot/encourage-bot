FROM node:argon

# create app directory 
RUN mkdir -p /usr/src/app 
WORKDIR /usr/src/app 

#install botkit 
RUN npm install botkit --save 
RUN npm install node-schedule --save
RUN npm install --save when
RUN npm install redis
COPY pepbot.js /usr/src/app/ 
COPY package.json /usr/src/app/ 

#set startup commands
CMD ["npm", "start"]