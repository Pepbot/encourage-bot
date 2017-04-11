const formatUptime = (uptimeParam) => {
  let unit = 'second';
  let uptime = uptimeParam;
  if (uptime > 60) {
    uptime /= 60;
    unit = 'minute';
  }
  if (uptime > 60) {
    uptime /= 60;
    unit = 'hour';
  }
  if (uptime !== 1) {
    unit = `${unit}s`;
  }
  uptime = `${uptime} ${unit}`;
  return uptime;
};

module.exports = { formatUptime };
