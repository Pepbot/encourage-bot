const express = require('express');

const app = express();

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('encouragesplash');
});

app.get('/why-pepper', (req, res) => {
  res.render('whypepper');
});

app.use(express.static(__dirname + '/styles'));

app.listen((process.env.PORT || 3000), () => {
  console.log('Example app listening on port');
});
