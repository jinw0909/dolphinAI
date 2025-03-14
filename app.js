require('dotenv').config();
// require('./scheduler');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const fetchRouter = require('./routes/fetch');
const { birdeyeRouter} = require('./routes/birdeye');
const { tokensRouter } = require('./routes/tokens');
const { cleanerRouter} = require('./routes/cleaner');
const { portfolioRouter} = require('./routes/portfolio');
const { targetRouter } = require('./routes/target');
const { gptRouter } = require('./routes/gpt');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/fetch', fetchRouter);
app.use('/birdeye', birdeyeRouter);
app.use('/tokens', tokensRouter);
app.use('/clean', cleanerRouter);
app.use('/portfolio', portfolioRouter);
app.use('/target', targetRouter);
app.use('/gpt', gptRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
