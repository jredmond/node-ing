
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , stylus = require('stylus')
  , nib = require('nib')
  , mongoose = require('mongoose');

var app = express();

//Added function to allow use nib with stylus
//nib generates cross browser syntax
function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}

app.configure(function(){
  app.set('port', process.env.PORT || 1337);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(stylus.middleware(
    {src: __dirname + '/public'
    , compile: compile
    }
  ));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);


var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

//open a connection to the chat mongo database
mongoose.connect('mongodb://localhost/chat');

var db =  mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

//Socket.io for websocket chat and disable logging
var io = require('socket.io').listen(server, {log: false});

//Namespace socket
var chat = io.of('/chat');

var count = 0;
var usernames = {};
var serverName = '<font color="#fa5b4d">SERVER</font>';

//callback to indicate db connection has happened
db.once('open', function callback() {
  console.log('connected to chat db');


  //define database schema
  var messageSchema = mongoose.Schema({
    name:String,
    message:String,
    date: {type:Date, default:Date.now}
  });
  //compile schema into model
  var Message = mongoose.model('Message',messageSchema);

  //clear database
  Message.collection.drop(function(err){

    //Chat socket event handlers
    chat.on('connection', function(socket) {

      //new user on chat load previous messages from database
      socket.username = "anon"+count;
      console.log(socket.username+" connected");
      count++;
      usernames[socket.username] = false;
      Message.find({}).sort('date').execFind(function(err,messages) {
        if(err) throw err;

        for(var i = 0; i < messages.length; i++) {
          socket.volatile.emit('updatechat', messages[i].name, messages[i].message);
        }
        socket.volatile.emit('updatechat', serverName, 'You have connected');
        socket.volatile.broadcast.emit('updatechat', serverName, socket.username + ' has connected');
        var newMessage = new Message({name: serverName, message:socket.username + ' has connected'});
        newMessage.save(function(err, newMessage) {if(err) throw err;});
        chat.volatile.emit('updateusers', usernames);
      })



      //When a message is posted broadcast to all
      socket.on('sendchat', function(m) {
        chat.volatile.emit('updatechat', socket.username, m);
        var newMessage = new Message({name: socket.username, message:m});
        newMessage.save(function(err, newMessage) {if(err) throw err;});
      });
      //When a client starts typing broadcast to all
      socket.on('typing', function(status) {
        usernames[socket.username] = status;
        chat.volatile.emit('updateusers', usernames);
      });
      //Reply for /ping chat command
      socket.on('ping', function() {
        socket.volatile.emit('pong');
      });
      socket.on('username', function(username) {
        var reAnon = new RegExp("^anon");
        if(usernames[username] !== undefined || reAnon.test(username)) {
          socket.volatile.emit('updatechat', serverName, 'Username ' + username + ' is unavailable');
        } else {
          //Change user's name
          socket.volatile.emit('updatechat', serverName, 'You have changed your name to '+ username);
          socket.volatile.broadcast.emit('updatechat', serverName, socket.username + ' has changed name to ' + username);
          var newMessage = new Message({name: serverName, message: socket.username + ' has changed name to ' + username});
          newMessage.save(function(err, newMessage) {if(err) throw err;});
          var status = usernames[socket.username];
          delete usernames[socket.username];
          socket.username = username;
          usernames[socket.username] = status;
          chat.volatile.emit('updateusers', usernames);
        }
      });
      socket.on('disconnect', function() {
        delete usernames[socket.username];
        //update list of users on each client
        chat.volatile.emit('updateusers', usernames);
        socket.volatile.broadcast.emit('updatechat', serverName, socket.username +' has disconnected');
        var newMessage = new Message({name: serverName, message: socket.username +' has disconnected'});
        newMessage.save(function(err, newMessage) {if(err) throw err;});
      });
    });
  });
});