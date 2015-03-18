DROP DATABASE IF EXISTS urlshortener;
CREATE DATABASE urlshortener;
USE urlshortener;

-- event_scheduler täytyy asettaa, että luotu event ajetaan ajastetusti
SET GLOBAL event_scheduler = 1;

SET @CLEANUP_INTERVAL_MINUTES = 1;

CREATE TABLE url (
  shorturl VARCHAR(30) NOT NULL,
  longurl VARCHAR(400) NOT NULL,
  expirationtime TIMESTAMP,
  PRIMARY KEY (shortUrl)
) ENGINE=InnoDB;

DELIMITER //
CREATE EVENT cleanup
  ON SCHEDULE 
    EVERY @CLEANUP_INTERVAL_MINUTES SECOND
  DO
  BEGIN
    DELETE FROM url 
      WHERE EXTRACT(YEAR FROM expirationtime) && expirationtime < NOW();
  END //
DELIMITER ;
