const getUsername = (message) => {
  const arr = message.split(' ');
  let username = arr[1];
  username = username.toString();
  username = username.replace('@', '');
  username = username.replace('<', '');
  username = username.replace('>', '');
  return username;
};

module.exports = { getUsername };
