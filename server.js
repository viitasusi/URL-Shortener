// HTTP-palvelin
var express = require('express');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var port = 3001;

// MySQL
var mysql = require('mysql');
var connectionName;
// Alla olevien tulee vastata MySQL-tietokantaa
var dbname = 'urlshortener';
var tablename = 'url';
var columnname = ['shorturl', 'longurl', 'expirationtime'];

// Crypto / SHA1-hash
var crypto = require('crypto');
var sha;

// shortUrl-arvon luontiparametrit
var shortUrlMaxLength = 30; // Vastaa tietokannan shortUrl-kentän maksimipituutta
var shortUrlDefaultLength = 10; // Vastaa automaatisesti luodun oletus-shortUrl:n pituutta
// iDivider määrittää, kuinka monessa osassa shortUrlDefaultLength merkkiä pitkä
// satunnainen shortUrl-kentän arvo luodaan. Oletusarvona 2 (==10/5).
var iDivider = shortUrlDefaultLength / 5;

// MySQL-yhteysolio
var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : 'Cac0f0n3',
	database : dbname,
});

app.use(express.static(__dirname));

// Palvelin palauttaa automaattisesti samasta hakemistosta 
// löytyvän index.html:n, joten alla kommentoitu osa on tarpeeton.
/*
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});
*/

// Sivupyyntö [palvelin]/lyhytUrl, esim. http://localhost:3000/lyhytUrl
// Regex pattern * sieppaa kaikki osoitteet.
app.get('/*', function(req, res){

	// Poista URL:stä etukauttaviiva
	var inputUrl = req.url.substr(1);

	// Varmista, että syötetyssä osoitteessa on vain pieniä 
	// tai isoja kirjaimia, numeroita ja/tai viivoja ja
	// osoitteen pituus on enintään säädetty maksimi
	if (inputUrl.match('^([A-Za-z0-9-])+$') &&
			inputUrl.length <= shortUrlMaxLength)
	{	
	  // Vertaa osoitetta tietokantaan.
	  // MySQL-lausekkeen kentän arvoviittaus on case-insensitive,
	  // mikä on ok, koska verkko-osoitteissakaan kirjainkoolla
	  // ei ole merkitystä.
	  connection.query(
			"SELECT * from " + tablename + 
				" WHERE " + columnname[0] + " = '" + inputUrl + "'", 
    	function (err, rows) {
				if (err)
					console.log("MySQL redirect query failed:", err);
				else {
					if (rows.length)
						// Lyhyttä URL:ää vastaava pitkä osoite löytyi tietokannasta.
						RedirectToPage(res, rows[0].longurl);
					else
						// Osoitetta ei löytynyt tietokannasta -> ohjaus pääsivulle.
						RedirectToPage(res, req.headers.host);
				}
			}
		);
	}
	else
		// Syötetty lyhyt URL liian pitkä ollakseen tietokannassa
		// -> ohjaus pääsivulle.
		RedirectToPage(res, req.headers.host);
});

// Palauta javascript-koodi, joka ohjaa osoitteeseen addressTo.
function RedirectToPage(res, addressTo) {
	res.send(
		'<script type="text/javascript">location = "' +
		// Lisää "http://", jos protokolla puuttuu (esim. "localhost").
		(addressTo.match(/^(https?|ftp):\/\//)
			? '' : 'http://') + addressTo + '"</script>');
};

io.on('connection', function(socket) {
	console.log("New connection from " + socket.handshake.address);

  socket.on('add_url', function(msg) {
  	// msg == JSON.stringify(longUrl, shortUrl, sqlUrlExpirationString)
  	// longUrl on validoitu pitkä URL.
  	// shortUrl on validoitu lyhyt URL, joka voi olla myös tyhjä.
  	// sqlUrlExpirationString on MySQL:n DATE_ADD()-funktion kanssa yhteensopiva 
  	// aikaperiodimerkkijono, joka määrittää URL:n vanhenemisajan. null == ei koskaan.

  	var obj = JSON.parse(msg);
  	
  	var shortUrl;
  	var longUrl = obj.longUrl;
  	var sqlUrlExpirationString = obj.sqlUrlExpirationString;
  	var duplicateFound;
  	do
  	{ 
  		duplicateFound = false;
	  	if (!obj.shortUrl.length)
	  	{
	  		// Käyttäjä ei syöttänyt lyhyttä URL:ää.
	  		// Luo satunnainen, muuttujan shortUrlDefaultLength arvon pituinen
	  		// tietokannan shortUrl-kentän merkkijono.
	  		// Merkkijono luodaan monivaiheisesti pilkottua SHA1-hashia apuna 
	  		// käyttäen satunnaislukugeneraattorin palauttamista lukuarvoista.
	  		
	  		shortUrl = "";
	  		var hash;
		  	for (var i = 0; i < iDivider; i++)
				{
					// Luo joku 1000000 mahdollisesta SHA1 hashista ja ota satunnaisesta
					// kohdasta pätkä, joka muodostaa shortUrl:n yhden osan.

					// Luo uusi SHA1-olio
					sha = crypto.createHash('sha1');
					// Päivitä SHA1-hash annetulla satunnaisluvulla
					sha.update((Math.floor(Math.random() * 1000000)).toString());
					// SHA1 hash heksamerkkijonona (40 merkkiä pitkä)
					hash = sha.digest('hex');
					// Liitä shortUrl:n osa shortUrl-merkkijonon jatkoksi
					shortUrl += hash.substr(
									Math.floor(Math.random() * 1000000) % 
										(hash.length - Math.floor(shortUrlDefaultLength / iDivider) + 1), 
									Math.floor(shortUrlDefaultLength / iDivider));
				}
			}
			else
				// Käyttäjä syötti itse lyhyen URL:n
				shortUrl = obj.shortUrl;

			/*
			console.log("shortUrl: " + shortUrl);
			console.log("longUrl: " + longUrl);
			console.log("sqlUrlExpirationString: " + sqlUrlExpirationString);
			*/

			// Tee duplikaattien tarkastuskysely tietokantaan
			connection.query( 
		  	"SELECT COUNT(*) AS COUNT FROM " + tablename + 
		  		" WHERE " + columnname[0] + " = '" + shortUrl + "'",
		  	function (err, rows) {
		  		if (err)
						console.log("MySQL duplicate entry check query failed:", err);
					else 
					{
						var existingRowCount = rows[0].COUNT;
						if (existingRowCount)
						{
							if (obj.shortUrl.length)
							{
								// Käyttäjä syötti lyhyen URL:n itse, mutta se löytyy jo tietokannasta
								// -> ilmoita käyttäjälle asiasta ja lopeta suoritus
								socket.emit('duplicate_custom_shortUrl', obj.shortUrl);
								return;
							}
							else
								// Automaattisesti generoitu lyhyt URL löytyy jo tietokannasta
								// -> aloita uusi silmukan kierros uuden lyhyen URL:n luomiseksi
								duplicateFound = true;
						}
						else
						{
							// Uniikki shortUrl varmistettu
							// Luo uusi merkintä tietokantaan
							var sqlExpirationTimeQuery = 
								sqlUrlExpirationString 
									? 'DATE_ADD(NOW(), INTERVAL ' + sqlUrlExpirationString + ')'
									: '00000000000000';
							
							connection.query(
								"INSERT INTO " + tablename + 
									' VALUES (?, ?, ' + sqlExpirationTimeQuery + ')', 
								[ shortUrl, longUrl ],
					    	function(err, rows)
					    	{
									if (err)
										console.log("failed:", err);
									else
									{
										console.log("Row added: " + (rows.affectedRows == true));
										socket.emit(
											'url_added', 
											JSON.stringify({ 'short' : shortUrl, 'long' : longUrl })
										);
									}
								}
							);
						} // else
					} // else
			  } // function (err, rows)
		  ); // connection.query
		} while (duplicateFound); 
  }); // socket.on('add_url', function(msg))
}); // io.on(connection, function(socket))

http.listen(port, function(){
  console.log('listening on http://localhost:' + port);
});