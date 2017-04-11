const getAdminUsers = () => {
  const adminUsers = [];
  bot.api.users.list({}, (err, response) => {
    if (response.hasOwnProperty('members') && response.ok) {
      const members = response.members;
      for (let i = 0; i < members.length; i + 1) {
        if (members[i].is_admin) {
          adminUsers.push(members[i]);
        }
      }
    }
  });
  return adminUsers;
};

module.exports = { getAdminUsers };
