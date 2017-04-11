const getEncouragement = (encouragement) => {
  const arr = encouragement.split(' ');
  arr.splice(0, 2);
  return arr.join(' ');
};

module.exports = { getEncouragement };
