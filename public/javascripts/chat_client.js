//requires the socket.io and jquery scripts to be loaded into the html first

//connect to server (autodiscover ip and port)
var chat = io.connect('/chat');

//socket.on('connect', function() {...});
var numUsers = 0;
//update user list
chat.on('updateusers', function(data) {
	numUsers = 0;
	$('#users').empty();
	$.each(data, function(key, value) {
		if(value)
			key += " <font color='#fa5b4d'><b>...</b></font>";
		$('#users').append('<div>' + key + '</div>');
		numUsers++;
	});
});

//Previous Message Author
var prevUser = "";
var pageFocused = true;
var chatTyping = false;
var emitTime = 0;
var serverName = '<font color="#fa5b4d">SERVER</font>';

//on load of page
$(document).ready(function() {

	//Chat sound
	var chatAlert = document.createElement('audio');
	chatAlert.setAttribute('src', 'sounds/alert.mp3');

	chatBox = document.getElementById("conversation");
	var autoScroll = false;

	//display message
	var displayMessage = function(username, data) {
		//check if scroll box is at the bottom
		autoScroll = (chatBox.scrollHeight - chatBox.scrollTop == chatBox.offsetHeight);

		//Post the message
		if(prevUser !== username)
			data = '<b>' + username + ':</b> ' + data;
		$('#conversation').append(data + '<br>');
		prevUser = username;

		//Snap scrollbar to bottom
		if(autoScroll)
			chatBox.scrollTop = chatBox.scrollHeight;

		//Play chat alert if needed
		if(!pageFocused)
			chatAlert.play();
	};

	//recieve new message
	chat.on('updatechat', function(username, data) {
		displayMessage(username, data);
	});
	//Output latency
	chat.on('pong', function() {
		displayMessage(serverName, 'Latency (round-trip time): ' + (+new Date - emitTime) + 'ms')
	});

	//handle user pressing enter
	$('#data').keypress(function(e) {
		if(e.which == 13 && !e.shiftKey) {
			//read and clear chat input
			var message = $('#data').val().replace(/\n/g, "<br />");
			$('#data').val('');

			//detect user commands
			var reUser = new RegExp("^/user ");
			var rePing = new RegExp("^/ping");
			if(reUser.test(message)) {
				chat.emit('username', message.substring(6))
			} else if(rePing.test(message)) {
				emitTime = +new Date;
				chat.emit('ping');
			} else {
				//send chat message to server on the socket
				chat.emit('sendchat', message);
				chatBox.scrollTop = chatBox.scrollHeight;
			}
		}
	});

	//auto expand text box
	$('#data').on('keyup paste', function() {
		var ta = document.getElementById('data');
		var maxrows = 5;
		var lh = ta.clientHeight / ta.rows;
		while (ta.scrollHeight > ta.clientHeight && !window.opera && ta.rows < maxrows) {
			ta.style.overflow = 'hidden';
			ta.rows += 1;
	  	}
	  	if (ta.scrollHeight > ta.clientHeight) ta.style.overflow = 'auto';
	});
	$('#data').keyup(function(e) {
		if(e.which == 13 && !e.shiftKey) {
			//reset the auto expand entry field
			var ta = document.getElementById('data');
			$('#data').val('');
			ta.rows = 2;
			ta.style.overflow = 'hidden';
		}
	});

	//Indicate that user is typing
	$('#data').on('keyup keydown paste', function() {
		var textInBox = ($('#data').val() != '');
		if(chatTyping !== textInBox) {
			chatTyping = textInBox;
			chat.emit('typing', chatTyping);
		}
	});
	
	//check if window is focused
	window.addEventListener('focus', function() {
	    pageFocused = true;
	});

	window.addEventListener('blur', function() {
	    pageFocused = false;
	});

	//try out smoothie chart
	var dataSet1 = new TimeSeries();
	var now = new Date().getTime();
	dataSet1.append(now, numUsers);
	setInterval(function() {
		var now = new Date().getTime();
		dataSet1.append(now, numUsers);
	}, 10000);

	// Build the timeline
	var smoothie = new SmoothieChart({ timestampFormatter: SmoothieChart.timeFormatter, minValue: 0.0, maxValue: 10, fps: 1, interpolation: "line", millisPerPixel: 12000, grid: { fillStyle: '#333', strokeStyle: '#555', lineWidth: 1, millisPerLine: 600000, verticalSections: 5 }});
	smoothie.addTimeSeries(dataSet1, { strokeStyle: 'rgba(0, 255, 0, 1)',   fillStyle: 'rgba(0, 255, 0, 0.2)',   lineWidth: 2 });

	smoothie.streamTo(document.getElementById('smoothiecanvas'));

});