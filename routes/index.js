
/*
 * GET home page.
 */

 var moment = require('moment');

exports.index = function(req, res){
  res.render('index', {
    title: 'Home',
    //load socket.io, jquery.min.js and chat_client.js scripts
    scripts: ['/socket.io/socket.io.js', 'https://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js', '/javascripts/chat_client.js','/javascripts/smoothie.js']
  });
  console.log("[" + require('moment')().format('ddd DD/MM/YY h:mm A') + "]: " + req.connection.remoteAddress + " requests /");
};