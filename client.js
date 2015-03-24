var socket = io("http://localhost");

var longUrlInputElement;
var shortUrlInputElement;
var shortUrlExpirationElement;
var shortUrlOutputElement;


onload = function() {
	
	longUrlInputElement = document.getElementById("longUrlInput");
	shortUrlInputElement = document.getElementById("shortUrlInput");
	urlExpirationElement = document.getElementById("urlExpirationTime");
	shortUrlOutputElement = document.getElementById("shortUrlOutput");
	document.getElementById("btn").addEventListener("click", onClickButton);
};

// Tee lyhyt -painikkeen event listener callback -funktio
function onClickButton() {
	// Tyhjennä mahdollinen edellinen lyhyt URL -lisäysilmoitus
	shortUrlOutputElement.innerHTML = '';

	// Pitkä URL -käsittely
	var longUrl = longUrlInputElement.value;
	if (longUrl != "")
	{
		// Validoi URL-syöte. Regex-hirviö otettu netistä pienin muutoksin.
  	// https://gist.github.com/dperini/729294
  	var urlRegex = new RegExp(
  		'^(?:(?:https?|ftp):\\/\\/)?' +
  		'(?:\\S+(?::\\S*)?@)?(?:(?!(?:10|127)' + 
  		'(?:\\.\\d{1,3}){3})(?!(?:169\\.254|192\\.168)' + 
  		'(?:\\.\\d{1,3}){2})(?!172\\.(?:1[6-9]|2\\d|3[0-1])' + 
  		'(?:\\.\\d{1,3}){2})(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' + 
  		'(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' + 
  		'(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' + 
  		'|(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' + 
  		'(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' + 
  		'(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))(?::\\d{2,5})?(?:\\/\\S*)?$');
  	
  	// Varmista, onko URL ok
  	if (urlRegex.test(longUrl))
  	{
  		// URL ok, lisää "http://", jos protokolla puuttuu.
	  	if (!longUrl.match(/^(https?|ftp):\/\//))
	  		longUrl = "http://" + longUrl;

	  	// Oma lyhyt URL -käsittely
	  	var shortUrl = shortUrlInputElement.value;
			if (shortUrl != "")
			{
				// Validoi syöte
				if (!shortUrl.match('^([A-Za-z0-9-])+$'))
				{
					shortUrlOutputElement.innerHTML = '<p>Epäkelpo lyhyt URL: ' + shortUrl + '</p>';
					return;
				}
			}

			var sqlUrlExpirationString;
			// URL:n vanhenemisaika
			switch(urlExpirationElement.value)
			{
				case 'never':
					sqlUrlExpirationString = null;
				break;
				case '10minutes':
					sqlUrlExpirationString = '10 MINUTE';
				break;
				case 'hour':
					sqlUrlExpirationString = '1 HOUR';
				break;
				case 'day':
					sqlUrlExpirationString = '1 DAY';
				break;
				case 'week':
					sqlUrlExpirationString = '1 WEEK';
				break;
				case '2weeks':
					sqlUrlExpirationString = '2 WEEK';
				break;
				case 'month':
					sqlUrlExpirationString = '1 MONTH';
				break;
				default:
					sqlUrlExpirationString = '10 MINUTE';
				break;
			}

			socket.emit(
				"add_url", 
				JSON.stringify({
					'longUrl': longUrl, 
					'shortUrl': shortUrl,
					'sqlUrlExpirationString': sqlUrlExpirationString })
			);
  	}
  	else
  		shortUrlOutputElement.setAttribute('class','visible');
  		shortUrlOutputElement.innerHTML = '<p>Epäkelpo pitkä URL: ' + longUrl + '</p>';
	}
};

//////////////////////////////////////////////////
// SOCKET.IO EVENTS
//////////////////////////////////////////////////
socket.on('url_added', function(result) {
	// result == JSON.stringify( short, long )
	// Onnistuneen URL-lisäyksen paluuarvot,
	// short == lyhennetty URL, long == alkuperäinen pitkä URL
	obj = JSON.parse(result);
	var shortUrl = document.URL + obj.short;
	shortUrlOutputElement.setAttribute('class','visible');
	shortUrlOutputElement.innerHTML = 
		"<p>Antamasi URL: <a href=\"" + obj.long + "\">" + obj.long + "</a></p>" +
		"<p>Lyhyt URL: <a href=\"" + shortUrl + "\">" + shortUrl + "</a></p>";
});


socket.on('duplicate_custom_shortUrl', function(result) {
	// result == lyhyt URL, jonka käyttäjä syötti itse ja joka löytyy jo tietokannasta.
	
	var duplicateShortUrl = result;
	
	shortUrlOutputElement.setAttribute('class','visible');
	shortUrlOutputElement.innerHTML = 
		"<p>Antamasi lyhyt URL \"" + result + "\" on varattu.";
});

socket.on('url_found', function(result) {
	// result == pitkä URL-osoite, joka löytyi tietokannasta
	// ja johon siirrytään selaimella
	console.log(result);
	window.location.assign(result);
});
