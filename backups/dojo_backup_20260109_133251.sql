mysqldump: [Warning] Using a password on the command line interface can be insecure.
Warning: A partial dump from a server that has GTIDs will by default include the GTIDs of all transactions, even those that changed suppressed parts of the database. If you don't want to restore GTIDs, pass --set-gtid-purged=OFF. To make a complete dump, pass --all-databases --triggers --routines --events. 
Warning: A dump from a server that has GTIDs enabled will by default include the GTIDs of all transactions, even those that were executed during its extraction and might not be represented in the dumped data. This might result in an inconsistent data dump. 
In order to ensure a consistent backup of the database, pass --single-transaction or --lock-all-tables or --source-data. 
-- MySQL dump 10.13  Distrib 9.5.0, for macos26.1 (arm64)
--
-- Host: localhost    Database: dojo
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '9db829d4-ed49-11f0-a238-038dbc05e261:1-597';
mysqldump: Error: 'Access denied; you need (at least one of) the PROCESS privilege(s) for this operation' when trying to dump tablespaces

--
-- Table structure for table `admin_activity_log`
--

DROP TABLE IF EXISTS `admin_activity_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_activity_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL,
  `aktion` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bereich` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `betroffene_entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `betroffene_entity_id` int DEFAULT NULL,
  `ip_adresse` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_aktion` (`aktion`),
  KEY `idx_bereich` (`bereich`),
  KEY `idx_erstellt_am` (`erstellt_am`),
  KEY `idx_entity` (`betroffene_entity_type`,`betroffene_entity_id`),
  CONSTRAINT `admin_activity_log_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_activity_log`
--

LOCK TABLES `admin_activity_log` WRITE;
/*!40000 ALTER TABLE `admin_activity_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_activity_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_user_dojos`
--

DROP TABLE IF EXISTS `admin_user_dojos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_user_dojos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_user_id` int NOT NULL,
  `dojo_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_dojo` (`admin_user_id`,`dojo_id`),
  KEY `dojo_id` (`dojo_id`),
  CONSTRAINT `admin_user_dojos_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_user_dojos_ibfk_2` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_user_dojos`
--

LOCK TABLES `admin_user_dojos` WRITE;
/*!40000 ALTER TABLE `admin_user_dojos` DISABLE KEYS */;
INSERT INTO `admin_user_dojos` VALUES (1,1,2,'2026-01-07 05:35:05'),(2,1,3,'2026-01-07 05:35:05'),(3,4,4,'2026-01-07 05:35:05');
/*!40000 ALTER TABLE `admin_user_dojos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int DEFAULT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vorname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nachname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rolle` enum('super_admin','admin','mitarbeiter','eingeschraenkt') COLLATE utf8mb4_unicode_ci DEFAULT 'eingeschraenkt',
  `berechtigungen` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `aktiv` tinyint(1) DEFAULT '1',
  `email_verifiziert` tinyint(1) DEFAULT '0',
  `letzter_login` timestamp NULL DEFAULT NULL,
  `login_versuche` int DEFAULT '0',
  `gesperrt_bis` timestamp NULL DEFAULT NULL,
  `session_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_ablauf` timestamp NULL DEFAULT NULL,
  `reset_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_token_ablauf` timestamp NULL DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `erstellt_von` int DEFAULT NULL,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `aktualisiert_von` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`),
  KEY `idx_rolle` (`rolle`),
  KEY `idx_aktiv` (`aktiv`),
  KEY `idx_session_token` (`session_token`),
  KEY `idx_letzter_login` (`letzter_login`),
  CONSTRAINT `admin_users_chk_1` CHECK (json_valid(`berechtigungen`))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES (1,NULL,'admin','admin@dojo.local','$2b$10$YourHashedPasswordHere','System','Administrator','super_admin','{\"admins\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"berichte\": {\"lesen\": true, \"exportieren\": true}, \"finanzen\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"dashboard\": {\"lesen\": true}, \"vertraege\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"mitglieder\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"pruefungen\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"stundenplan\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"einstellungen\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}}',1,1,NULL,0,NULL,NULL,NULL,NULL,NULL,'2025-11-16 07:39:52',NULL,'2025-11-16 07:39:52',NULL),(3,NULL,'TrainerloginTDA','trainer@tda.local','$2b$10$xbmodBntoDWp5kaKobVGMOPhDhUX5DJ3GAfBIjF30mc7KJJSSaBDW','Trainer','TDA','eingeschraenkt','{\"checkin\": true, \"anwesenheit\": true}',1,1,NULL,0,NULL,NULL,NULL,NULL,NULL,'2025-12-07 10:34:43',NULL,'2025-12-07 10:34:43',NULL),(4,4,'demo','demo@zugang.de','$2b$10$KIVxenTilhkd1EwXBa/Uw.fZdXIjurSbwPmKe2XkFENqlUIx/rI4e','Demo','Zugang','admin',NULL,1,1,NULL,0,NULL,NULL,NULL,NULL,NULL,'2026-01-06 06:05:13',NULL,'2026-01-08 08:17:20',NULL);
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anwesenheit`
--

DROP TABLE IF EXISTS `anwesenheit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anwesenheit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `stundenplan_id` int NOT NULL,
  `datum` date NOT NULL,
  `anwesend` tinyint(1) NOT NULL DEFAULT '0',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_anwesenheit_eintrag` (`mitglied_id`,`stundenplan_id`,`datum`),
  KEY `stundenplan_id` (`stundenplan_id`),
  KEY `idx_anwesenheit_datum` (`datum` DESC),
  KEY `idx_anwesenheit_dojo_id` (`dojo_id`),
  CONSTRAINT `anwesenheit_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `anwesenheit_ibfk_2` FOREIGN KEY (`stundenplan_id`) REFERENCES `stundenplan` (`stundenplan_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=128 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anwesenheit`
--

LOCK TABLES `anwesenheit` WRITE;
/*!40000 ALTER TABLE `anwesenheit` DISABLE KEYS */;
INSERT INTO `anwesenheit` VALUES (1,68,19,'2025-12-08',1,'2025-12-08 16:04:26',1),(3,185,19,'2025-12-08',1,'2025-12-08 20:45:18',1),(5,164,19,'2025-12-08',1,'2025-12-08 20:45:19',1),(7,109,19,'2025-12-08',0,'2025-12-08 20:45:34',1),(9,99,19,'2025-12-08',1,'2025-12-08 20:45:22',1),(11,74,19,'2025-12-08',1,'2025-12-08 20:45:27',1),(13,78,19,'2025-12-08',1,'2025-12-08 20:45:28',1),(16,164,20,'2025-12-08',1,'2025-12-08 20:45:46',1),(18,109,20,'2025-12-08',1,'2025-12-08 20:45:48',1),(20,99,20,'2025-12-08',1,'2025-12-08 20:45:50',1),(22,112,20,'2025-12-08',1,'2025-12-08 20:45:51',1),(24,74,20,'2025-12-08',1,'2025-12-08 20:45:57',1),(26,118,20,'2025-12-08',1,'2025-12-08 20:45:57',1),(28,169,20,'2025-12-08',1,'2025-12-08 20:45:58',1),(30,120,20,'2025-12-08',1,'2025-12-08 20:46:00',1),(32,68,23,'2025-12-09',1,'2025-12-09 16:31:50',1),(34,78,23,'2025-12-09',1,'2025-12-09 16:31:51',1),(36,164,24,'2025-12-09',1,'2025-12-09 16:32:17',1),(38,68,24,'2025-12-09',1,'2025-12-09 16:32:27',1),(40,90,25,'2025-12-09',1,'2025-12-09 16:32:45',1),(42,89,25,'2025-12-09',1,'2025-12-09 16:32:52',1),(44,179,25,'2025-12-09',1,'2025-12-09 16:32:59',1),(46,164,25,'2025-12-09',1,'2025-12-09 16:33:06',1),(48,112,26,'2025-12-09',1,'2025-12-09 16:42:31',1),(50,118,26,'2025-12-09',1,'2025-12-09 16:42:37',1),(52,80,27,'2025-12-09',1,'2025-12-09 18:48:49',1),(54,79,27,'2025-12-09',1,'2025-12-09 18:48:55',1),(56,185,22,'2025-12-17',1,'2025-12-18 15:28:24',1),(57,185,22,'2025-12-18',1,'2025-12-18 15:28:24',1),(58,83,22,'2025-12-17',1,'2025-12-18 15:28:26',1),(59,83,22,'2025-12-18',1,'2025-12-18 15:28:26',1),(60,109,22,'2025-12-17',1,'2025-12-18 15:28:28',1),(61,109,22,'2025-12-18',1,'2025-12-18 15:28:28',1),(62,68,22,'2025-12-17',1,'2025-12-18 15:28:33',1),(63,68,22,'2025-12-18',1,'2025-12-18 15:28:34',1),(64,84,22,'2025-12-17',1,'2025-12-18 15:28:36',1),(65,84,22,'2025-12-18',1,'2025-12-18 15:28:36',1),(66,116,22,'2025-12-17',1,'2025-12-18 15:28:40',1),(67,116,22,'2025-12-18',1,'2025-12-18 15:28:41',1),(68,78,22,'2025-12-17',1,'2025-12-18 15:28:42',1),(69,78,22,'2025-12-18',1,'2025-12-18 15:28:42',1),(70,80,29,'2025-12-17',1,'2025-12-18 15:28:46',1),(71,80,29,'2025-12-18',1,'2025-12-18 15:28:46',1),(72,81,29,'2025-12-17',1,'2025-12-18 15:28:47',1),(73,81,29,'2025-12-18',1,'2025-12-18 15:28:47',1),(74,174,30,'2025-12-17',1,'2025-12-18 15:28:54',1),(75,174,30,'2025-12-18',1,'2025-12-18 15:28:54',1),(76,148,30,'2025-12-17',1,'2025-12-18 15:28:55',1),(77,148,30,'2025-12-18',1,'2025-12-18 15:28:55',1),(78,80,30,'2025-12-17',1,'2025-12-18 15:28:58',1),(79,80,30,'2025-12-18',1,'2025-12-18 15:28:58',1),(80,81,30,'2025-12-17',1,'2025-12-18 15:28:59',1),(81,81,30,'2025-12-18',1,'2025-12-18 15:28:59',1),(82,140,30,'2025-12-17',1,'2025-12-18 15:29:02',1),(83,140,30,'2025-12-18',1,'2025-12-18 15:29:02',1),(84,68,23,'2025-12-16',1,'2025-12-18 15:29:17',1),(85,68,23,'2025-12-18',1,'2025-12-18 15:29:17',1),(86,78,23,'2025-12-16',1,'2025-12-18 15:29:18',1),(87,78,23,'2025-12-18',1,'2025-12-18 15:29:18',1),(88,170,22,'2025-12-17',1,'2025-12-18 15:29:28',1),(89,170,22,'2025-12-18',1,'2025-12-18 15:29:28',1),(90,179,24,'2025-12-16',1,'2025-12-18 15:29:54',1),(91,179,24,'2025-12-18',1,'2025-12-18 15:29:54',1),(92,89,24,'2025-12-16',1,'2025-12-18 15:30:02',1),(93,89,24,'2025-12-18',1,'2025-12-18 15:30:02',1),(94,89,25,'2025-12-16',1,'2025-12-18 15:30:08',1),(95,89,25,'2025-12-18',1,'2025-12-18 15:30:09',1),(96,179,25,'2025-12-16',1,'2025-12-18 15:30:11',1),(97,179,25,'2025-12-18',1,'2025-12-18 15:30:11',1),(98,90,25,'2025-12-16',1,'2025-12-18 15:30:19',1),(99,90,25,'2025-12-18',1,'2025-12-18 15:30:19',1),(100,112,26,'2025-12-16',1,'2025-12-18 15:30:40',1),(101,112,26,'2025-12-18',1,'2025-12-18 15:30:40',1),(102,118,26,'2025-12-16',1,'2025-12-18 15:30:58',1),(103,118,26,'2025-12-18',1,'2025-12-18 15:30:58',1),(104,68,22,'2026-01-07',1,'2026-01-07 16:02:35',1),(106,109,22,'2026-01-07',1,'2026-01-07 16:03:07',1),(108,84,22,'2026-01-07',1,'2026-01-07 16:07:34',1),(110,87,22,'2026-01-07',1,'2026-01-07 16:08:15',1),(112,170,22,'2026-01-07',1,'2026-01-07 16:08:31',1),(114,78,22,'2026-01-07',1,'2026-01-07 16:14:58',1),(116,153,29,'2026-01-07',1,'2026-01-07 17:17:14',1),(118,81,29,'2026-01-07',1,'2026-01-07 17:17:48',1),(120,81,30,'2026-01-07',1,'2026-01-07 18:20:32',1),(122,134,30,'2026-01-07',1,'2026-01-07 18:20:48',1),(124,153,30,'2026-01-07',1,'2026-01-07 18:21:00',1),(126,174,30,'2026-01-07',1,'2026-01-08 12:32:59',1),(127,174,30,'2026-01-08',1,'2026-01-08 12:32:59',1);
/*!40000 ALTER TABLE `anwesenheit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anwesenheit_protokoll`
--

DROP TABLE IF EXISTS `anwesenheit_protokoll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anwesenheit_protokoll` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `stundenplan_id` int NOT NULL,
  `datum` date NOT NULL,
  `status` enum('anwesend','verspätet','entschuldigt','unentschuldigt','abgebrochen') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'anwesend',
  `bemerkung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_anwesenheit` (`mitglied_id`,`stundenplan_id`,`datum`),
  KEY `stundenplan_id` (`stundenplan_id`),
  CONSTRAINT `anwesenheit_protokoll_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `anwesenheit_protokoll_ibfk_2` FOREIGN KEY (`stundenplan_id`) REFERENCES `stundenplan` (`stundenplan_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=127 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anwesenheit_protokoll`
--

LOCK TABLES `anwesenheit_protokoll` WRITE;
/*!40000 ALTER TABLE `anwesenheit_protokoll` DISABLE KEYS */;
INSERT INTO `anwesenheit_protokoll` VALUES (1,68,19,'2025-12-08','anwesend','Check-in via manual um 17:04','2025-12-08 16:04:26'),(3,185,19,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:18'),(5,164,19,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:19'),(7,109,19,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:20'),(9,99,19,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:22'),(11,74,19,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:27'),(13,78,19,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:28'),(15,164,20,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:46'),(17,109,20,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:48'),(19,99,20,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:50'),(21,112,20,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:51'),(23,74,20,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:56'),(25,118,20,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:57'),(27,169,20,'2025-12-08','anwesend','Check-in via manual um 21:45','2025-12-08 20:45:58'),(29,120,20,'2025-12-08','anwesend','Check-in via manual um 21:46','2025-12-08 20:46:00'),(31,68,23,'2025-12-09','abgebrochen','Check-in via manual um 17:31 - Ausgecheckt um 17:35','2025-12-09 16:31:50'),(33,78,23,'2025-12-09','abgebrochen','Check-in via manual um 17:31 - Ausgecheckt um 17:35','2025-12-09 16:31:51'),(35,164,24,'2025-12-09','abgebrochen','Check-in via manual um 17:32 - Ausgecheckt um 21:32','2025-12-09 16:32:17'),(37,68,24,'2025-12-09','abgebrochen','Check-in via manual um 17:32 - Ausgecheckt um 21:32','2025-12-09 16:32:26'),(39,90,25,'2025-12-09','abgebrochen','Check-in via manual um 17:32 - Ausgecheckt um 21:32','2025-12-09 16:32:45'),(41,89,25,'2025-12-09','abgebrochen','Check-in via manual um 17:32 - Ausgecheckt um 21:32','2025-12-09 16:32:52'),(43,179,25,'2025-12-09','abgebrochen','Check-in via manual um 17:32 - Ausgecheckt um 21:32','2025-12-09 16:32:58'),(45,164,25,'2025-12-09','abgebrochen','Check-in via manual um 17:33 - Ausgecheckt um 21:32','2025-12-09 16:33:06'),(47,112,26,'2025-12-09','abgebrochen','Check-in via manual um 17:42 - Ausgecheckt um 21:32','2025-12-09 16:42:31'),(49,118,26,'2025-12-09','abgebrochen','Check-in via manual um 17:42 - Ausgecheckt um 21:32','2025-12-09 16:42:37'),(51,80,27,'2025-12-09','abgebrochen','Check-in via manual um 19:48 - Ausgecheckt um 21:32','2025-12-09 18:48:49'),(53,79,27,'2025-12-09','abgebrochen','Check-in via manual um 19:48 - Ausgecheckt um 21:32','2025-12-09 18:48:55'),(55,185,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:24'),(56,185,22,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:24'),(57,83,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:26'),(58,83,22,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:26'),(59,109,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:28'),(60,109,22,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:28'),(61,68,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:33'),(62,68,22,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:34'),(63,84,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:36'),(64,84,22,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:36'),(65,116,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:40'),(66,116,22,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:41'),(67,78,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:42'),(68,78,22,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:42'),(69,80,29,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:46'),(70,80,29,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:46'),(71,81,29,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:47'),(72,81,29,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:47'),(73,174,30,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:54'),(74,174,30,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:54'),(75,148,30,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:55'),(76,148,30,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:55'),(77,80,30,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:58'),(78,80,30,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:58'),(79,81,30,'2025-12-17','anwesend',NULL,'2025-12-18 15:28:59'),(80,81,30,'2025-12-18','abgebrochen','Check-in via manual um 16:28 - Ausgecheckt um 23:07','2025-12-18 15:28:59'),(81,140,30,'2025-12-17','anwesend',NULL,'2025-12-18 15:29:02'),(82,140,30,'2025-12-18','abgebrochen','Check-in via manual um 16:29 - Ausgecheckt um 23:07','2025-12-18 15:29:02'),(83,68,23,'2025-12-16','anwesend',NULL,'2025-12-18 15:29:17'),(84,68,23,'2025-12-18','abgebrochen','Check-in via manual um 16:29 - Ausgecheckt um 23:07','2025-12-18 15:29:17'),(85,78,23,'2025-12-16','anwesend',NULL,'2025-12-18 15:29:18'),(86,78,23,'2025-12-18','abgebrochen','Check-in via manual um 16:29 - Ausgecheckt um 23:07','2025-12-18 15:29:18'),(87,170,22,'2025-12-17','anwesend',NULL,'2025-12-18 15:29:28'),(88,170,22,'2025-12-18','abgebrochen','Check-in via manual um 16:29 - Ausgecheckt um 23:07','2025-12-18 15:29:28'),(89,179,24,'2025-12-16','anwesend',NULL,'2025-12-18 15:29:54'),(90,179,24,'2025-12-18','abgebrochen','Check-in via manual um 16:29 - Ausgecheckt um 23:07','2025-12-18 15:29:54'),(91,89,24,'2025-12-16','anwesend',NULL,'2025-12-18 15:30:02'),(92,89,24,'2025-12-18','abgebrochen','Check-in via manual um 16:30 - Ausgecheckt um 23:07','2025-12-18 15:30:02'),(93,89,25,'2025-12-16','anwesend',NULL,'2025-12-18 15:30:08'),(94,89,25,'2025-12-18','abgebrochen','Check-in via manual um 16:30 - Ausgecheckt um 23:07','2025-12-18 15:30:09'),(95,179,25,'2025-12-16','anwesend',NULL,'2025-12-18 15:30:11'),(96,179,25,'2025-12-18','abgebrochen','Check-in via manual um 16:30 - Ausgecheckt um 23:07','2025-12-18 15:30:11'),(97,90,25,'2025-12-16','anwesend',NULL,'2025-12-18 15:30:19'),(98,90,25,'2025-12-18','abgebrochen','Check-in via manual um 16:30 - Ausgecheckt um 23:07','2025-12-18 15:30:19'),(99,112,26,'2025-12-16','anwesend',NULL,'2025-12-18 15:30:40'),(100,112,26,'2025-12-18','abgebrochen','Check-in via manual um 16:30 - Ausgecheckt um 23:07','2025-12-18 15:30:40'),(101,118,26,'2025-12-16','anwesend',NULL,'2025-12-18 15:30:58'),(102,118,26,'2025-12-18','abgebrochen','Check-in via manual um 16:30 - Ausgecheckt um 23:07','2025-12-18 15:30:58'),(103,68,22,'2026-01-07','anwesend','Check-in via manual um 17:02','2026-01-07 16:02:35'),(105,109,22,'2026-01-07','anwesend','Check-in via manual um 17:03','2026-01-07 16:03:07'),(107,84,22,'2026-01-07','anwesend','Check-in via manual um 17:07','2026-01-07 16:07:34'),(109,87,22,'2026-01-07','anwesend','Check-in via manual um 17:08','2026-01-07 16:08:15'),(111,170,22,'2026-01-07','anwesend','Check-in via manual um 17:08','2026-01-07 16:08:31'),(113,78,22,'2026-01-07','anwesend','Check-in via manual um 17:14','2026-01-07 16:14:58'),(115,153,29,'2026-01-07','anwesend','Check-in via manual um 18:17','2026-01-07 17:17:13'),(117,81,29,'2026-01-07','anwesend','Check-in via manual um 18:17','2026-01-07 17:17:48'),(119,81,30,'2026-01-07','anwesend','Check-in via manual um 19:20','2026-01-07 18:20:31'),(121,134,30,'2026-01-07','anwesend','Check-in via manual um 19:20','2026-01-07 18:20:48'),(123,153,30,'2026-01-07','anwesend','Check-in via manual um 19:21','2026-01-07 18:21:00'),(125,174,30,'2026-01-07','anwesend',NULL,'2026-01-08 12:32:59'),(126,174,30,'2026-01-08','anwesend','Check-in via manual um 13:32','2026-01-08 12:32:59');
/*!40000 ALTER TABLE `anwesenheit_protokoll` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `archiv_mitglied_stil_data`
--

DROP TABLE IF EXISTS `archiv_mitglied_stil_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `archiv_mitglied_stil_data` (
  `archiv_stil_id` int NOT NULL AUTO_INCREMENT,
  `archiv_id` int NOT NULL COMMENT 'Referenz zur archiv_mitglieder Tabelle',
  `mitglied_id` int NOT NULL,
  `stil_id` int NOT NULL,
  `current_graduierung_id` int DEFAULT NULL,
  `aktiv_seit` date DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `archiviert_am` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`archiv_stil_id`),
  KEY `idx_archiv_id` (`archiv_id`),
  KEY `idx_mitglied_id` (`mitglied_id`),
  CONSTRAINT `archiv_mitglied_stil_data_ibfk_1` FOREIGN KEY (`archiv_id`) REFERENCES `archiv_mitglieder` (`archiv_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archiv_mitglied_stil_data`
--

LOCK TABLES `archiv_mitglied_stil_data` WRITE;
/*!40000 ALTER TABLE `archiv_mitglied_stil_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `archiv_mitglied_stil_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `archiv_mitglieder`
--

DROP TABLE IF EXISTS `archiv_mitglieder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `archiv_mitglieder` (
  `archiv_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL COMMENT 'UrsprÃ¼ngliche Mitgliedsnummer',
  `dojo_id` int DEFAULT NULL,
  `vorname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nachname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geburtsdatum` date DEFAULT NULL,
  `strasse` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `land` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Deutschland',
  `telefon` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `eintrittsdatum` date DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci,
  `foto_pfad` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tarif_id` int DEFAULT NULL,
  `zahlungszyklus_id` int DEFAULT NULL,
  `gekuendigt` tinyint(1) DEFAULT '0',
  `gekuendigt_am` date DEFAULT NULL,
  `kuendigungsgrund` text COLLATE utf8mb4_unicode_ci,
  `vereinsordnung_akzeptiert` tinyint(1) DEFAULT '0',
  `vereinsordnung_datum` date DEFAULT NULL,
  `security_question` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `security_answer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stil_daten` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Alle Stil-Zuordnungen und Graduierungen als JSON',
  `sepa_mandate` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Alle SEPA-Mandate als JSON',
  `pruefungen` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Alle PrÃ¼fungen als JSON',
  `user_daten` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Login-Daten (ohne Passwort) als JSON',
  `archiviert_am` datetime DEFAULT CURRENT_TIMESTAMP,
  `archiviert_von` int DEFAULT NULL COMMENT 'User-ID des Administrators',
  `archivierungsgrund` text COLLATE utf8mb4_unicode_ci,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`archiv_id`),
  KEY `idx_mitglied_id` (`mitglied_id`),
  KEY `idx_nachname` (`nachname`),
  KEY `idx_email` (`email`),
  KEY `idx_archiviert_am` (`archiviert_am`),
  KEY `idx_dojo_id` (`dojo_id`),
  CONSTRAINT `archiv_mitglieder_chk_1` CHECK (json_valid(`stil_daten`)),
  CONSTRAINT `archiv_mitglieder_chk_2` CHECK (json_valid(`sepa_mandate`)),
  CONSTRAINT `archiv_mitglieder_chk_3` CHECK (json_valid(`pruefungen`)),
  CONSTRAINT `archiv_mitglieder_chk_4` CHECK (json_valid(`user_daten`))
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archiv_mitglieder`
--

LOCK TABLES `archiv_mitglieder` WRITE;
/*!40000 ALTER TABLE `archiv_mitglieder` DISABLE KEYS */;
INSERT INTO `archiv_mitglieder` VALUES (2,62,1,'Adalya','Calik','2020-10-01','Von-Neuhaus-Str.','84155','Bodenkirchen','Deutschland','017620470639','calikstephanie@t-online.de','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-07 09:45:44',1,'Mitglied archiviert','2025-12-07 08:45:44','2025-12-07 08:45:44'),(3,73,1,'Richard','Hilger','2010-02-12','Hauptstraße','84155','Bodenkirchen','Deutschland','015170332745','melanie-hilger@web.de','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":40,\"mitglied_id\":73,\"mandatsreferenz\":\"MLREFM00021\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2025-02-12T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE70743923000000414697\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Melanie Hilger\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:15.000Z\",\"updated_at\":\"2025-12-04T10:29:15.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-07 09:52:52',1,'Mitglied archiviert','2025-12-07 08:52:52','2025-12-07 08:52:52'),(4,108,1,'Safiia','Begova','2013-04-06','Kirchstr.','84137','Vilsbiburg','Deutschland','017683019637','begov.83@t-online.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":72,\"mitglied_id\":108,\"mandatsreferenz\":\"MLREF100015\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-04T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE27743500000020953479\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Zafar Begov\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-07 22:16:48',1,'Mitglied archiviert','2025-12-07 21:16:48','2025-12-07 21:16:48'),(5,103,3,'Susanne','Cwickel','1994-06-07','Schloßparkstr.','84175','Gerzen','Deutschland','017640401998','susanne.cwickel@mail.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":67,\"mitglied_id\":103,\"mandatsreferenz\":\"MLREF100023\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-06T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE97743200730029528160\",\"bic\":\"HYVEDEMM433\",\"kontoinhaber\":\"Susanne Cwickel\",\"bankname\":\"UniCredit Bank - HypoVereinsbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-07 22:40:15',1,'Mitglied archiviert','2025-12-07 21:40:15','2025-12-07 21:40:15'),(6,163,3,'Florian','Druschinski','2012-03-09','Escherstr.','84155','Bodenkirchen','Deutschland','015731755110',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-07 22:40:29',1,'Mitglied archiviert','2025-12-07 21:40:29','2025-12-07 21:40:29'),(7,139,3,'Miriam','de Gonzague','2014-12-29','Lindenstr.','84155','Bodenkirchen','Deutschland','015128838707','de.gonzague@icloud.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":93,\"mitglied_id\":139,\"mandatsreferenz\":\"MLREF100045\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-14T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE64743923000000882151\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Jasmin de Gonzague\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:04.000Z\",\"updated_at\":\"2025-12-07T21:15:04.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-07 22:49:50',1,'Mitglied archiviert','2025-12-07 21:49:50','2025-12-07 21:49:50'),(8,144,3,'Julius','Bachmeyer-Ammer','2010-10-11','Lärchenstr.','84155','Bodenkirchen','Deutschland','+49 1512 8851593','aj@ammer.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 08:58:41',NULL,'Bulk-Archivierung durch Admin','2025-12-08 07:58:41','2025-12-08 07:58:41'),(9,165,3,'Jenny','Bachmann','2012-02-14','Bergstr.','84307','Eggenfelden','Deutschland','015737630196',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 08:58:41',NULL,'Bulk-Archivierung durch Admin','2025-12-08 07:58:41','2025-12-08 07:58:41'),(10,129,3,'Youssef','Ben Khalifa','2008-06-21','Hochkalter Str.','84137','Vilsbiburg','Deutschland','017636108080','meriam.aualid@gmx.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:15',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:15','2025-12-08 08:02:15'),(11,180,3,'Marina','Englbrecht','1992-04-09','Kirchstetten','84137','Vilsbiburg','Deutschland','015154773203',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(12,100,3,'Anton','Englbrecht','2017-06-17','Kirchstetten','84137','Vilsbiburg','Deutschland','015154773203','marinaschaumeier@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(13,106,3,'Benjamin','Freimüller','2014-12-20','Lilienstr.','84155','Bodenkirchen','Deutschland','01732670903','madalina88@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":70,\"mitglied_id\":106,\"mandatsreferenz\":\"MLREF100041\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-09T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE36701695300002512823\",\"bic\":\"GENODEF1RWZ\",\"kontoinhaber\":\"Robert Freimueller\",\"bankname\":\"Raiffeisenbank Neumarkt-St. Veit - Reischach\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(14,107,3,'Jakob','Freimüller','2013-09-28','Lilienstr.','84155','Bodenkirchen','Deutschland','01732670903',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":71,\"mitglied_id\":107,\"mandatsreferenz\":\"MLREF100040\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-09T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE36701695300002512823\",\"bic\":\"GENODEF1RWZ\",\"kontoinhaber\":\"Robert Freimueller\",\"bankname\":\"Raiffeisenbank Neumarkt-St. Veit - Reischach\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(15,141,3,'Verena','Geltinger','1996-09-12','Schachterstr.','84137','Vilsbiburg','Deutschland','+491709661405','verena.geltinger@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":96,\"mitglied_id\":141,\"mandatsreferenz\":\"MLREF100048\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-09-18T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE57743500000004485637\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Verena Geltinger\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:05.000Z\",\"updated_at\":\"2025-12-07T21:15:05.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(16,161,3,'Anna-Maria','Harlander','1995-03-01','Wifling','84155','Bodenkirchen','Deutschland','015157851259','anna.held1@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(17,110,3,'Joana','Glaser','2011-03-30','Fliederstraße','84155','Bodenkirchen','Deutschland','0171/3833681',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":74,\"mitglied_id\":110,\"mandatsreferenz\":\"MLREF100042\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-09T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE40743923000000899267\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Anna Katanzyma Glaser\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(18,105,3,'Alexander','Hiermer','2012-02-26','Kirchstettenerstr.','84155','Bodenkirchen','Deutschland','01704766604','kerstin.m8@freenet.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":69,\"mitglied_id\":105,\"mandatsreferenz\":\"MLREF100033\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-02T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE55743923000000888036\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Kerstin Hiermer\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(19,104,3,'Florian','Hiermer','2013-09-21','Kirchstettenerstr.','84155','Bodenkirchen','Deutschland','01704766604','kerstin.m8@freenet.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":68,\"mitglied_id\":104,\"mandatsreferenz\":\"MLREF100032\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-02T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE55743923000000888036\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Kerstin Hiermer\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(20,124,3,'Wieland','Hofer','2015-06-01','Weihprechting','84564','Oberbergkirchen','Deutschland','01755416406','christoph@zwei.gmbh','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(21,171,3,'Lorena','Huber','2020-01-21','Gartenstr.','84155','Bodenkirchen','Deutschland','01712629531',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":118,\"mitglied_id\":171,\"mandatsreferenz\":\"MLREF100082\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2023-10-24T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE18743923000000896268\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Andreas Huber\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:14.000Z\",\"updated_at\":\"2025-12-07T21:15:14.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(22,157,3,'Julia','Jenczmionka','2013-10-17','Binastr.','84155','Bodenkirchen','Deutschland','01749058122','Jenczmionka.michal@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":107,\"mitglied_id\":157,\"mandatsreferenz\":\"MLREF100038\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-03T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE86743500000004142705\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Michel Jenczmionka\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:10.000Z\",\"updated_at\":\"2025-12-07T21:15:10.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(23,66,3,'Nicol','Ilieva','2014-12-29','Sportplatzstr.','84155','Bodenkirchen','Deutschland','015786609155','antonio0545@web.de','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":33,\"mitglied_id\":66,\"mandatsreferenz\":\"MLREFM00014\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-12-14T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE66743500000020378246\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Donka Nedelcheva\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:15.000Z\",\"updated_at\":\"2025-12-04T10:29:15.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(24,67,3,'Chris','Ilieva','2019-09-09','Sportplatzstr.','84155','Bodenkirchen','Deutschland','015786609155','antonio0545@web.de','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":34,\"mitglied_id\":67,\"mandatsreferenz\":\"MLREFM00015\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-12-14T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE66743500000020378246\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Donka Nedelcheva\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:15.000Z\",\"updated_at\":\"2025-12-04T10:29:15.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(25,150,3,'Mila','Kölbl','2016-09-26','Straubingerstr.','84307','Eggenfelden','Deutschland',NULL,'koelbl.katja1212@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(26,167,3,'Eileen','Köditz','2003-06-18','Bergstr.','84307','Eggenfelden','Deutschland','01779296622','eileenkoditz@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":114,\"mitglied_id\":167,\"mandatsreferenz\":\"MLREF100039\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-03T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE63740618130005060060\",\"bic\":\"GENODEF1PFK\",\"kontoinhaber\":\"Katja Koelbl\",\"bankname\":\"VR-Bank Rottal-Inn\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:12.000Z\",\"updated_at\":\"2025-12-07T21:15:12.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(27,114,3,'Felix','Kroiß','2014-09-28','Frauensattlinger Str.','84155','Binabiburg','Deutschland','015735225793','maxkroiss@gmx.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(28,187,3,'Amar','Kuleta','2014-01-03','Peter Deuring Str7, Peter Deuring Str7','84155','Bodenkirchen','Deutschland','+491791449676','indiracanaj115@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":134,\"mitglied_id\":187,\"mandatsreferenz\":\"MLREF100098\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-02-19T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE43743500000021313449\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Amar Kuleta\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:18.000Z\",\"updated_at\":\"2025-12-07T21:15:18.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(29,186,3,'Tanja','Lohr','1980-11-06','Margarethen ','84155','Bodenkirchen ','Deutschland','01714991139','tanja.lohr@josko.la','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":133,\"mitglied_id\":186,\"mandatsreferenz\":\"MLREF100097\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-02-17T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE39743923000000860000\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Tanja Lohr\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:18.000Z\",\"updated_at\":\"2025-12-07T21:15:18.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(30,183,3,'Tanja','Lohr','1980-11-06','Margarethen ','84155','Bodenkirchen ','Deutschland','01714991139','tanja.lohr@josko-landshut.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":130,\"mitglied_id\":183,\"mandatsreferenz\":\"MLREF100094\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-01-07T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE39743923000000860000\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Tanja Lohr\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:17.000Z\",\"updated_at\":\"2025-12-07T21:15:17.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(31,155,3,'Alexander','Lenz','2016-08-31','Hub','84573','Schönberg','Deutschland','01708026116','juergenlenz1@gmx.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":105,\"mitglied_id\":155,\"mandatsreferenz\":\"MLREF100066\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-11-07T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE28743923000000421758\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Christine Lenz\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:09.000Z\",\"updated_at\":\"2025-12-07T21:15:09.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(32,132,3,'Candice Abigail','Mack','1987-10-22','Ellersberg','84137','Vilsbiburg','Deutschland','017672664798','candicemack10@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":88,\"mitglied_id\":132,\"mandatsreferenz\":\"MLREF100029\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-07T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE24860400000253603500\",\"bic\":\"COBADEFFXXX\",\"kontoinhaber\":\"Candice Abigail Mack\",\"bankname\":\"Commerzbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:02.000Z\",\"updated_at\":\"2025-12-07T21:15:02.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(33,133,3,'Joel','Mack','2015-10-05','Ellersberg','84137','Vilsbiburg','Deutschland','017672664798','michel.mack@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":89,\"mitglied_id\":133,\"mandatsreferenz\":\"MLREF100030\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-07T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE24860400000253603500\",\"bic\":\"COBADEFFXXX\",\"kontoinhaber\":\"Michel Mack\",\"bankname\":\"Commerzbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:02.000Z\",\"updated_at\":\"2025-12-07T21:15:02.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(34,131,3,'Michel','Mack','1987-06-27','Ellersberg','84137','Vilsbiburg','Deutschland','017672664798',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":87,\"mitglied_id\":131,\"mandatsreferenz\":\"MLREF100028\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-07T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE24860400000253603500\",\"bic\":\"COBADEFFXXX\",\"kontoinhaber\":\"Michel Mack\",\"bankname\":\"Commerzbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:02.000Z\",\"updated_at\":\"2025-12-07T21:15:02.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(35,115,3,'Karol','Marciniak','1999-06-30','Hauptstr.','84155','Bodenkirchen','Deutschland','01602165105','kkaarol5@icloud.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(36,98,3,'Knauf','Markus','2000-07-19','Am Kellerberg','84175','Gerzen','Deutschland','015155229329','markusknauf@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":64,\"mitglied_id\":98,\"mandatsreferenz\":\"MLREF100109\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-06-30T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE13743923000003235513\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Knauf Markus\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:44.000Z\",\"updated_at\":\"2025-12-07T21:14:44.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:16',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:16','2025-12-08 08:02:16'),(37,158,3,'Felix','Pirgl','2002-12-01','Ruselstr.','84155','Bodenkirchen','Deutschland','015172944741','felix-pirgl@t-online.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":108,\"mitglied_id\":158,\"mandatsreferenz\":\"MLREF100068\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-11-17T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE22743500000020760345\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Felix Pirgl\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:10.000Z\",\"updated_at\":\"2025-12-07T21:15:10.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(38,137,3,'Zacharias','Most','2011-06-02','Rosenstr.','84149','Velden','Deutschland','015114390995',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(39,63,3,'Maximilian','Meier','2013-09-02','Meisenstr.','84155','Bodenkirchen','Deutschland','015170336821','Michaela.meier87@googlemail.com','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":30,\"mitglied_id\":63,\"mandatsreferenz\":\"MLREFM00011\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-12-09T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE89500502011242809293\",\"bic\":\"HELADEF1822\",\"kontoinhaber\":\"Michaela Meier\",\"bankname\":\"Frankfurter Sparkasse\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:15.000Z\",\"updated_at\":\"2025-12-04T10:29:15.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(40,128,3,'Alexa','Plozki','2016-01-25','Rosenstr.','84155','Bodenkirchen','Deutschland','01796037548','praskoviya13@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":86,\"mitglied_id\":128,\"mandatsreferenz\":\"MLREF100026\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-06T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE13600100700295584706\",\"bic\":\"PBNKDEFFXXX\",\"kontoinhaber\":\"Andreas Plozki\",\"bankname\":\"Postbank Ndl der Deutsche Bank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:02.000Z\",\"updated_at\":\"2025-12-07T21:15:02.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(41,127,3,'Valerie','Plozki','2014-02-26','Rosenstr.','84155','Bodenkirchen','Deutschland','01796037548','praskovija13@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":85,\"mitglied_id\":127,\"mandatsreferenz\":\"MLREF100025\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-06T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE13600100700295584706\",\"bic\":\"PBNKDEFFXXX\",\"kontoinhaber\":\"Andreas Plozki\",\"bankname\":\"Postbank Ndl der Deutsche Bank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:01.000Z\",\"updated_at\":\"2025-12-07T21:15:01.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(42,130,3,'Lukas','Pöll','2011-03-04','Pfründestr.','84137','Vilsbiburg','Deutschland','016095442468',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(43,181,3,'Melina','Popp','2011-10-07','Narzissenstraße','84155','Bodenkirchen','Deutschland','087459649773','samirapopp@googlemail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":128,\"mitglied_id\":181,\"mandatsreferenz\":\"MLREF100092\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2023-12-05T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE36743923000000805734\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Verena Popp\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:16.000Z\",\"updated_at\":\"2025-12-07T21:15:16.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(44,182,3,'Verena','Popp','1980-02-01','Narzissenstraße','84155','Bodenkirchen','Deutschland','087459649773','verenapopp80@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":129,\"mitglied_id\":182,\"mandatsreferenz\":\"MLREF100093\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2023-12-05T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE36743923000000805734\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Verena Popp\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:17.000Z\",\"updated_at\":\"2025-12-07T21:15:17.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(45,94,3,'Rafael','Schön','2018-12-10','Kampenwandstr ','84137','Vilsbiburg ','Deutschland','01735668446','daniel.schoen.2@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":60,\"mitglied_id\":94,\"mandatsreferenz\":\"MLREF100104\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-04-07T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE97500105175413040284\",\"bic\":\"INGDDEFFXXX\",\"kontoinhaber\":\"Daniel Schoen\",\"bankname\":\"ING-DiBa\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:44.000Z\",\"updated_at\":\"2025-12-07T21:14:44.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(46,95,3,'Elara','Schön','2017-10-23','Kampenwandstr.','84137','Vilsbiburg','Deutschland',NULL,'daniel.schoen.2@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":61,\"mitglied_id\":95,\"mandatsreferenz\":\"MLREF100103\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-03-31T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE97500105175413040284\",\"bic\":\"INGDDEFFXXX\",\"kontoinhaber\":\"Daniel Schoen\",\"bankname\":\"ING-DiBa\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:44.000Z\",\"updated_at\":\"2025-12-07T21:14:44.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(47,92,3,'Antje','Scherbening','1980-05-09','Wallbergstr. ','84137','Vilsbiburg ','Deutschland','0175-4377665 ','antjescherbening@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(48,91,3,'Sebastian','Schandl','1986-06-13','Lichtenburgerstraße','84137','Vilsbiburg','Deutschland','016094686596','sebastianschandl@me.com','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":58,\"mitglied_id\":91,\"mandatsreferenz\":\"MLREFM00009\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-07-10T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE09743200730011197132\",\"bic\":\"HYVEDEMM433\",\"kontoinhaber\":\"Sebastian Schandl\",\"bankname\":\"UniCredit Bank - HypoVereinsbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:18.000Z\",\"updated_at\":\"2025-12-04T10:29:18.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(49,122,3,'Maximilian','Schubert','2012-05-25','Peter-Deuring-Str.','84155','Bodenkirchen','Deutschland','015140155651',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":83,\"mitglied_id\":122,\"mandatsreferenz\":\"MLREF100017\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-06T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE15711510200031621618\",\"bic\":\"BYLADEM1MDF\",\"kontoinhaber\":\"Florian Schubert\",\"bankname\":\"Sparkasse Altötting-Mühldorf\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:59.000Z\",\"updated_at\":\"2025-12-07T21:14:59.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(50,154,3,'Mats','Schulte','2011-06-24','Sippenbach','84155','Bodenkirchen','Deutschland','01728361073','shkapstadt@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(51,188,3,'Lukas','Sojer','2011-07-17','Schulweg','84189','Wurmsham','Deutschland','+491757250018','floriansojer@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":135,\"mitglied_id\":188,\"mandatsreferenz\":\"MLREF100099\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-02-27T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE11743500000020819519\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Lukas Sojer\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:19.000Z\",\"updated_at\":\"2025-12-07T21:15:19.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(52,85,3,'Wolfgang','Strobl','1990-03-07','Rachelstrasse','84149','Velden','Deutschland','01701416924','strobl.wolfgang@outlook.de','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":52,\"mitglied_id\":85,\"mandatsreferenz\":\"MLREFM00003\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-01-26T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE68700202700035721495\",\"bic\":\"HYVEDEMMXXX\",\"kontoinhaber\":\"Wolfgang Strobl\",\"bankname\":\"UniCredit Bank - HypoVereinsbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:17.000Z\",\"updated_at\":\"2025-12-04T10:29:17.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(53,101,3,'Emma','Sterzer','2015-04-08','Fuchshöhe','84155','Bodenkirchen','Deutschland','087452850262',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":66,\"mitglied_id\":101,\"mandatsreferenz\":\"MLREF100043\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-04-09T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE11743923000000417408\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Regina Larsen\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:45.000Z\",\"updated_at\":\"2025-12-07T21:14:45.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(54,102,3,'Emma','Sterr','2014-04-27','Peyrerstr.','84155','Bonbruck','Deutschland','087459640059','tobiassterr@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(55,86,3,'Fabian','Then','1993-02-02','Sulding','84432 ','Hohenpolding','Deutschland','01708954891','fabian.then93@gmail.com','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":53,\"mitglied_id\":86,\"mandatsreferenz\":\"MLREFM00004\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-01-27T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE42700519950010091650\",\"bic\":\"BYLADEM1ERD\",\"kontoinhaber\":\"Fabian Then\",\"bankname\":\"Kreis- und Stadtsparkasse Erding-Dorfen\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:17.000Z\",\"updated_at\":\"2025-12-04T10:29:17.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(56,126,3,'Jan','Thiele','1987-08-21','Erdmannsdorferstr.','84155','Bodenkirchen','Deutschland','01627260354','j.thiele8746@yahoo.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":84,\"mitglied_id\":126,\"mandatsreferenz\":\"MLREF100013\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-03T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE37500100600848442607\",\"bic\":\"PBNKDEFFXXX\",\"kontoinhaber\":\"Jan Thiele\",\"bankname\":\"Postbank Ndl der Deutsche Bank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:00.000Z\",\"updated_at\":\"2025-12-07T21:15:00.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(57,121,3,'Leonie','Thiele','2015-08-22','Erdmannsdorferstrasse','84155','Bodenkirchen','Deutschland','01627260354','j.thiele8746@yahoo.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":81,\"mitglied_id\":121,\"mandatsreferenz\":\"MLREF100014\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-03T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE37500100600848442607\",\"bic\":\"PBNKDEFFXXX\",\"kontoinhaber\":\"Jan Thiele\",\"bankname\":\"Postbank Ndl der Deutsche Bank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:59.000Z\",\"updated_at\":\"2025-12-07T21:14:59.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(58,184,3,'Niko','Trigub','2017-04-03','Otterweg ','84155','Bodenkirchen','Deutschland','01701717039','nataliemiller47@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":131,\"mitglied_id\":184,\"mandatsreferenz\":\"MLREF100110\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-07-10T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE93743500000021076839\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Natalie Trigub\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:17.000Z\",\"updated_at\":\"2025-12-07T21:15:17.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(59,142,3,'Claudia','Weiß','1976-05-18','Lehing','84155','Bodenkirchen','Deutschland','+491755909718','mc-weiss@gmx.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":97,\"mitglied_id\":142,\"mandatsreferenz\":\"MLREF100053\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-09-21T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE52711600000102068435\",\"bic\":\"GENODEF1VRR\",\"kontoinhaber\":\"Claudia Weiss\",\"bankname\":\"meine Volksbank Raiffeisenbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:05.000Z\",\"updated_at\":\"2025-12-07T21:15:05.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(60,160,3,'Thomas','Weindl','1988-09-16','Buchnerstr.','84453','Mühldorf am Inn','Deutschland',NULL,'Weindltom@me.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(61,159,3,'Marius','Tutsch','2016-03-13','Rampoldsdorf','84144','Geisenhausen','Deutschland','+491601869434','ben.tutsch2814@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":109,\"mitglied_id\":159,\"mandatsreferenz\":\"MLREF100069\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-11-28T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE98743400770497774000\",\"bic\":\"COBADEFFXXX\",\"kontoinhaber\":\"Ben Tutsch\",\"bankname\":\"Commerzbank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:10.000Z\",\"updated_at\":\"2025-12-07T21:15:10.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(62,82,3,'Kevin','Wiesener','2002-04-09','Furth ','84326','Falkenberg ','Deutschland','‪+49 1522 8306196‬','kevinwiesener@gmail.com','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":49,\"mitglied_id\":82,\"mandatsreferenz\":\"MLREFM00002\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2023-12-10T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE54740618130006939791\",\"bic\":\"GENODEF1PFK\",\"kontoinhaber\":\"Kevin Wiesener\",\"bankname\":\"VR-Bank Rottal-Inn\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:16.000Z\",\"updated_at\":\"2025-12-04T10:29:16.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(63,176,3,'Florian','Wimmer','2018-02-24','Harpolden','84546','Egglkofen','Deutschland','016096740637','steffi-wimmer@gmx.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":124,\"mitglied_id\":176,\"mandatsreferenz\":\"MLREF100088\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2023-11-21T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE72701695300000700118\",\"bic\":\"GENODEF1RWZ\",\"kontoinhaber\":\"Stephanie Wimmer\",\"bankname\":\"Raiffeisenbank Neumarkt-St. Veit - Reischach\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:15.000Z\",\"updated_at\":\"2025-12-07T21:15:15.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(64,162,3,'Sophia','Wittmann','1998-10-11','Rachelstr.','84155','Bodenkirchen','Deutschland','015110625995','sophia.wimma@gmail.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":110,\"mitglied_id\":162,\"mandatsreferenz\":\"MLREF100072\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2023-03-06T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE76743500000020061749\",\"bic\":\"BYLADEM1LAH\",\"kontoinhaber\":\"Sophia Wittmann\",\"bankname\":\"Sparkasse Landshut\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:11.000Z\",\"updated_at\":\"2025-12-07T21:15:11.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(65,119,3,'Nela','Wortmann','2015-11-23','Hafnerweg','84155','Bonbruck','Deutschland','01701604840','wortmann-melanie@gmx.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":79,\"mitglied_id\":119,\"mandatsreferenz\":\"MLREF100021\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-06T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE53740618130000331490\",\"bic\":\"GENODEF1PFK\",\"kontoinhaber\":\"Christian Wortmann\",\"bankname\":\"VR-Bank Rottal-Inn\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:14:55.000Z\",\"updated_at\":\"2025-12-07T21:14:55.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 09:02:17',NULL,'Bulk-Archivierung durch Admin','2025-12-08 08:02:17','2025-12-08 08:02:17'),(66,135,3,'Malikcan','Adem','2015-04-22','Sportplatzstr.','84155','Bodenkirchen','Deutschland','017662987951','selim_adem_1968@hotmail.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":91,\"mitglied_id\":135,\"mandatsreferenz\":\"MLREF100105\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-04-22T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE82743923000000418846\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Selim Adem\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:03.000Z\",\"updated_at\":\"2025-12-07T21:15:03.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 16:23:09',NULL,'Bulk-Archivierung durch Admin','2025-12-08 15:23:09','2025-12-08 15:23:09'),(67,136,3,'M.-Furkan','Adem','2010-01-01','Sportplatzstr.','84155','Bodenkirchen','Deutschland','017662987951','selim_adem_1968@hotmail.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":92,\"mitglied_id\":136,\"mandatsreferenz\":\"MLREF100106\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2024-04-22T22:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE82743923000000418846\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Selim Adem\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:03.000Z\",\"updated_at\":\"2025-12-07T21:15:03.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-08 16:23:10',NULL,'Bulk-Archivierung durch Admin','2025-12-08 15:23:10','2025-12-08 15:23:10'),(68,147,3,'Tobias','Beisl','2003-05-11','Blankenöd','84140','Gangkofen','Deutschland','08735930001','tobiasbeisl@gmx.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-08 16:23:10',NULL,'Bulk-Archivierung durch Admin','2025-12-08 15:23:10','2025-12-08 15:23:10'),(69,123,3,'Leonhard Otto','Dietrich','2015-06-30','Oberndorf','84155','Bodenkirchen','Deutschland','015117263987','rosmariereiter@aol.com','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[]','[]',NULL,'2025-12-09 22:39:48',1,'Mitglied archiviert','2025-12-09 21:39:48','2025-12-09 21:39:48'),(70,70,3,'Andreas','Kammerer','2013-04-06','Erlenstr.','84155','Bodenkirchen','Deutschland','017645655281','samuelkammerer16@gmail.com','2025-12-04',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":37,\"mitglied_id\":70,\"mandatsreferenz\":\"MLREFM00018\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2025-03-23T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE62100100100132065130\",\"bic\":\"PBNKDEFFXXX\",\"kontoinhaber\":\"Andreas Kammerer\",\"bankname\":\"Postbank Ndl der Deutsche Bank\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-04T10:29:15.000Z\",\"updated_at\":\"2025-12-04T10:29:15.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-09 22:42:28',1,'Mitglied archiviert','2025-12-09 21:42:28','2025-12-09 21:42:28'),(71,178,3,'Marina','Lechner','2014-01-01','Margarethen','84155','Bodenkirchen','Deutschland','01702753505','monika-lechner1@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":126,\"mitglied_id\":178,\"mandatsreferenz\":\"MLREF100016\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-02-06T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE71743923000000252883\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Monika Lechner\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:15.000Z\",\"updated_at\":\"2025-12-07T21:15:15.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-10 08:37:33',1,'Mitglied archiviert','2025-12-10 07:37:33','2025-12-10 07:37:33'),(72,156,3,'David','Rosenkranz','2003-04-25','Rachelstrasse','84137','Vilsbiburg','Deutschland','017692466657','David--neo.rosenkranz@web.de','2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":106,\"mitglied_id\":156,\"mandatsreferenz\":\"MLREF100067\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-11-15T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE32700519950020322129\",\"bic\":\"BYLADEM1ERD\",\"kontoinhaber\":\"David Rosenkranz\",\"bankname\":\"Kreis- und Stadtsparkasse Erding-Dorfen\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:10.000Z\",\"updated_at\":\"2025-12-07T21:15:10.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-10 08:39:16',1,'Mitglied archiviert','2025-12-10 07:39:16','2025-12-10 07:39:16'),(73,151,3,'Daniel','Huber','2021-08-20','Von-Hohenthann-Str.','84155','Bodenkirchen','Deutschland','087451612',NULL,'2025-12-07',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,'[]','[{\"mandat_id\":102,\"mitglied_id\":151,\"mandatsreferenz\":\"MLREF100063\",\"glaeubiger_id\":\"DE98ZZZ09999999999\",\"erstellungsdatum\":\"2022-10-30T23:00:00.000Z\",\"status\":\"aktiv\",\"iban\":\"DE73743923000000883832\",\"bic\":\"GENODEF1VBV\",\"kontoinhaber\":\"Daniel Huber\",\"bankname\":\"VR-Bank Isar-Vils\",\"mandat_typ\":\"CORE\",\"sequenz\":\"FRST\",\"widerruf_datum\":null,\"ablaufdatum\":null,\"letzte_nutzung\":null,\"ersteller_user_id\":null,\"pdf_pfad\":null,\"created_at\":\"2025-12-07T21:15:08.000Z\",\"updated_at\":\"2025-12-07T21:15:08.000Z\",\"archiviert\":0,\"archiviert_am\":null,\"archiviert_grund\":null,\"provider\":\"manual_sepa\",\"stripe_setup_intent_id\":null,\"stripe_payment_method_id\":null}]','[]',NULL,'2025-12-10 08:42:22',1,'Mitglied archiviert','2025-12-10 07:42:22','2025-12-10 07:42:22');
/*!40000 ALTER TABLE `archiv_mitglieder` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `artikel`
--

DROP TABLE IF EXISTS `artikel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `artikel` (
  `artikel_id` int NOT NULL AUTO_INCREMENT,
  `kategorie_id` int NOT NULL,
  `artikelgruppe_id` int DEFAULT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `ean_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `artikel_nummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `einkaufspreis_cent` int DEFAULT '0',
  `verkaufspreis_cent` int NOT NULL,
  `mwst_prozent` decimal(5,2) NOT NULL DEFAULT '19.00',
  `lagerbestand` int DEFAULT '0',
  `mindestbestand` int DEFAULT '0',
  `lager_tracking` tinyint(1) DEFAULT '1',
  `bild_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bild_base64` longtext COLLATE utf8mb4_unicode_ci,
  `farbe_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#FFFFFF',
  `aktiv` tinyint(1) DEFAULT '1',
  `sichtbar_kasse` tinyint(1) DEFAULT '1',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `zusatzkosten_cent` int DEFAULT '0' COMMENT 'ZusÃ¤tzliche Kosten in Cent',
  `marge_prozent` decimal(5,2) DEFAULT NULL COMMENT 'Gewinnaufschlag in Prozent',
  `listeneinkaufspreis_cent` int DEFAULT '0' COMMENT 'Listeneinkaufspreis in Cent',
  `lieferrabatt_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Lieferrabatt in Prozent',
  `lieferskonto_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Lieferskonto (Zahlungsabzug) in Prozent',
  `bezugskosten_cent` int DEFAULT '0' COMMENT 'Bezugskosten (Versand, Zoll, Verpackung) in Cent',
  `gemeinkosten_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Gemeinkosten (Miete, Personal, etc.) in Prozent',
  `gewinnzuschlag_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Gewinnzuschlag in Prozent',
  `kundenskonto_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Kundenskonto (Zahlungsabzug für Kunden) in Prozent',
  `kundenrabatt_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Kundenrabatt in Prozent',
  PRIMARY KEY (`artikel_id`),
  UNIQUE KEY `artikel_nummer` (`artikel_nummer`),
  KEY `idx_kategorie` (`kategorie_id`),
  KEY `idx_aktiv` (`aktiv`),
  KEY `idx_ean` (`ean_code`),
  KEY `idx_artikel_nummer` (`artikel_nummer`),
  KEY `idx_artikel_aktiv_kasse` (`aktiv`,`sichtbar_kasse`),
  KEY `idx_artikel_lager` (`lager_tracking`,`lagerbestand`),
  KEY `idx_artikelgruppe_id` (`artikelgruppe_id`),
  CONSTRAINT `artikel_ibfk_1` FOREIGN KEY (`kategorie_id`) REFERENCES `artikel_kategorien` (`kategorie_id`) ON DELETE CASCADE,
  CONSTRAINT `artikel_ibfk_2` FOREIGN KEY (`artikelgruppe_id`) REFERENCES `artikelgruppen` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `artikel`
--

LOCK TABLES `artikel` WRITE;
/*!40000 ALTER TABLE `artikel` DISABLE KEYS */;
INSERT INTO `artikel` VALUES (1,1,1,'Karate Gi Weiß Größe 160','Klassischer weißer Karate-Anzug','4250123456001','GI-KAR-W-160',2500,5000,19.00,12,5,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-12-17 15:09:02',0,100.00,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(2,1,NULL,'Apfelschorle 0,5L','Erfrischende Apfelschorle','','GET002',200,800,19.00,30,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-12-17 19:34:34',20,100.00,200,0.00,0.00,0,100.00,100.00,0.00,0.00),(3,1,NULL,'Energy Drink','Koffeingetränk für mehr Energie',NULL,'GET003',0,250,19.00,25,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(4,1,NULL,'Proteinshake','Fertig gemischter Proteinshake',NULL,'GET004',0,350,19.00,20,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(5,2,NULL,'Proteinriegel','High-Protein Riegel 50g',NULL,'SNA001',0,280,7.00,40,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(6,2,NULL,'Nussmischung','Gesunde Nuss-Mix 100g',NULL,'SNA002',0,320,7.00,35,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(7,2,NULL,'Banane','Frische Banane',NULL,'SNA003',0,80,7.00,0,0,1,NULL,NULL,'#FFFFFF',0,1,'2025-10-18 04:04:42','2025-12-17 16:52:00',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(8,3,NULL,'Handschuhe','Boxhandschuhe Größe M',NULL,'EQU001',0,2500,19.00,15,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(9,3,NULL,'Gürtel','Karate-Gürtel weiß',NULL,'EQU002',0,1200,19.00,20,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(10,3,NULL,'Schutzausrüstung','Komplette Schutzausrüstung',NULL,'EQU003',0,4500,19.00,8,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(11,4,NULL,'Dojo-T-Shirt','Baumwoll-T-Shirt mit Dojo-Logo',NULL,'BEK001',0,1800,19.00,25,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(12,4,NULL,'Trainingshose','Bequeme Trainingshose',NULL,'BEK002',0,2200,19.00,18,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(13,4,NULL,'Hoodie','Kapuzenpullover mit Dojo-Logo',NULL,'BEK003',0,3500,19.00,12,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(14,5,NULL,'Whey Protein','Molkenprotein 1kg',NULL,'NAE001',0,2500,7.00,10,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(15,5,NULL,'Kreatin','Kreatin Monohydrat 500g',NULL,'NAE002',0,1800,7.00,15,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00),(16,5,NULL,'Multivitamin','Tägliche Vitamin-Tabletten',NULL,'NAE003',0,1200,7.00,20,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42',0,NULL,0,0.00,0.00,0,0.00,0.00,0.00,0.00);
/*!40000 ALTER TABLE `artikel` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `artikel_kategorien`
--

DROP TABLE IF EXISTS `artikel_kategorien`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `artikel_kategorien` (
  `kategorie_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `farbe_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#3B82F6',
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'package',
  `aktiv` tinyint(1) DEFAULT '1',
  `reihenfolge` int DEFAULT '0',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`kategorie_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `artikel_kategorien`
--

LOCK TABLES `artikel_kategorien` WRITE;
/*!40000 ALTER TABLE `artikel_kategorien` DISABLE KEYS */;
INSERT INTO `artikel_kategorien` VALUES (1,'Getränke','Erfrischungsgetränke, Wasser, Energydrinks','#10B981','coffee',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(2,'Snacks','Riegel, Nüsse, gesunde Snacks','#F59E0B','cookie',1,2,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(3,'Equipment','Trainingsausrüstung, Zubehör','#EF4444','dumbbell',1,3,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(4,'Bekleidung','Trainingskleidung, T-Shirts, Hosen','#8B5CF6','shirt',1,4,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(5,'Nahrungsergänzung','Proteine, Vitamine, Supplements','#06B6D4','pill',1,5,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(6,'Sonstiges','Verschiedene Artikel','#6B7280','more-horizontal',1,6,'2025-10-18 04:04:42','2025-10-18 04:04:42');
/*!40000 ALTER TABLE `artikel_kategorien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `artikelgruppen`
--

DROP TABLE IF EXISTS `artikelgruppen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `artikelgruppen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `parent_id` int DEFAULT NULL,
  `sortierung` int DEFAULT '0',
  `aktiv` tinyint(1) DEFAULT '1',
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `farbe` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_sortierung` (`sortierung`),
  KEY `idx_aktiv` (`aktiv`),
  CONSTRAINT `artikelgruppen_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `artikelgruppen` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `artikelgruppen`
--

LOCK TABLES `artikelgruppen` WRITE;
/*!40000 ALTER TABLE `artikelgruppen` DISABLE KEYS */;
INSERT INTO `artikelgruppen` VALUES (1,'Bekleidung','Kampfsport-Bekleidung und Uniformen',NULL,1,1,'?','#4A90E2','2025-10-18 04:09:06','2025-10-18 04:09:06'),(2,'Ausrüstung','Schutzausrüstung und Kampfausrüstung',NULL,2,1,'?️','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(3,'Supplemente','Ernährungsergänzungen und Sportnahrung',NULL,3,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(4,'Trainingszubehör','Trainingsgeräte und Übungsmaterial',NULL,4,1,'?','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(5,'Waffen & Training','Trainingswaffen und Übungswaffen',NULL,5,1,'⚔️','#9B59B6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(6,'Bücher & Medien','Lehrbücher, DVDs und Lernmaterialien',NULL,6,1,'?','#34495E','2025-10-18 04:09:06','2025-10-18 04:09:06'),(7,'Gürtel & Graduierung','Farbgürtel und Graduierungssysteme',NULL,7,1,'?️','#FFD700','2025-10-18 04:09:06','2025-10-18 04:09:06'),(8,'Erste Hilfe','Erste-Hilfe-Ausrüstung für Kampfsport',NULL,8,1,'?','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(9,'Reinigung & Pflege','Reinigungsmittel und Pflegeprodukte',NULL,9,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(10,'Taschen & Transport','Sporttaschen und Transportmittel',NULL,10,1,'?','#34495E','2025-10-18 04:09:06','2025-10-18 04:09:06'),(11,'Gi (Karate/Judo)','Traditionelle Kampfsport-Uniformen',1,1,1,'?','#3498DB','2025-10-18 04:09:06','2025-10-18 04:09:06'),(12,'Kickboxen','Kickboxing-spezifische Bekleidung',1,2,1,'?','#E67E22','2025-10-18 04:09:06','2025-10-18 04:09:06'),(13,'Hosen','Kampfsport-Hosen und Shorts',1,3,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(14,'Sets','Komplette Bekleidungs-Sets',1,4,1,'?','#9B59B6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(15,'Oberteile','Kampfsport-Oberteile und Shirts',1,5,1,'?','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(16,'T-Shirts','Kampfsport T-Shirts und Polos',1,6,1,'?','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(17,'Shorts','Kampfsport-Shorts und Training-Shorts',1,7,1,'?','#1ABC9C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(18,'Unterwäsche','Kampfsport-Unterwäsche und Rashguards',1,8,1,'?','#95A5A6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(21,'Kopfschutz','Helme und Kopfschutz für Kampfsport',2,1,1,'⛑️','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(22,'Handschuhe','Boxhandschuhe und Kampfsport-Handschuhe',2,2,1,'?','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(23,'Fußschoner','Fußschutz und Kampfsport-Schuhe',2,3,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(24,'Tiefschutz','Tiefschutz und Unterleibsschutz',2,4,1,'?️','#9B59B6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(25,'Mundschutz','Zahnschutz und Mundschutz',2,5,1,'?','#3498DB','2025-10-18 04:09:06','2025-10-18 04:09:06'),(26,'Schienbeinschutz','Schienbeinschoner und Beinschutz',2,6,1,'?','#E67E22','2025-10-18 04:09:06','2025-10-18 04:09:06'),(27,'Brustschutz','Brustschutz für Frauen',2,7,1,'?️','#E91E63','2025-10-18 04:09:06','2025-10-18 04:09:06'),(28,'Ellbogenschoner','Ellbogen- und Knieschoner',2,8,1,'?','#FF9800','2025-10-18 04:09:06','2025-10-18 04:09:06'),(31,'Protein','Proteinpulver und Eiweißpräparate',3,1,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(32,'Kreatin','Kreatin-Supplemente',3,2,1,'?','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(33,'Vitamine','Multivitamine und Mineralstoffe',3,3,1,'?','#3498DB','2025-10-18 04:09:06','2025-10-18 04:09:06'),(34,'Pre-Workout','Pre-Workout Booster',3,4,1,'⚡','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(35,'Post-Workout','Recovery und Post-Workout',3,5,1,'?','#9B59B6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(36,'Energieriegel','Sportriegel und Energieriegel',3,6,1,'?','#E67E22','2025-10-18 04:09:06','2025-10-18 04:09:06'),(37,'Getränke','Sportgetränke und Shakes',3,7,1,'?','#1ABC9C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(41,'Sandsäcke','Boxsäcke und Sandsäcke',4,1,1,'?','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(42,'Pratzen','Schlagpolster und Pratzen',4,2,1,'?','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(43,'Springseile','Boxseile und Trainingsseile',4,3,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(44,'Gewichte','Hanteln und Trainingsgewichte',4,4,1,'?️','#34495E','2025-10-18 04:09:06','2025-10-18 04:09:06'),(45,'Bälle','Medizinbälle und Trainingsbälle',4,5,1,'⚽','#3498DB','2025-10-18 04:09:06','2025-10-18 04:09:06'),(46,'Bänder','Resistance Bänder und Gummibänder',4,6,1,'?','#9B59B6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(47,'Matten','Trainingsmatten und Kampfsport-Matten',4,7,1,'?️','#1ABC9C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(48,'Timer','Box-Timer und Trainings-Timer',4,8,1,'⏰','#E67E22','2025-10-18 04:09:06','2025-10-18 04:09:06'),(51,'Bokken','Holzschwerter für Training',5,1,1,'⚔️','#8B4513','2025-10-18 04:09:06','2025-10-18 04:09:06'),(52,'Jo','Kampfstöcke und Stäbe',5,2,1,'?','#A0522D','2025-10-18 04:09:06','2025-10-18 04:09:06'),(53,'Tonfa','Tonfa-Training und Polizei-Stöcke',5,3,1,'?','#CD853F','2025-10-18 04:09:06','2025-10-18 04:09:06'),(54,'Nunchaku','Nunchaku-Training',5,4,1,'?','#D2691E','2025-10-18 04:09:06','2025-10-18 04:09:06'),(55,'Sai','Sai-Waffen und Dreizack',5,5,1,'?','#B22222','2025-10-18 04:09:06','2025-10-18 04:09:06'),(56,'Kama','Kama-Sicheln',5,6,1,'?','#228B22','2025-10-18 04:09:06','2025-10-18 04:09:06'),(57,'Bo','Langstöcke und Bo-Stäbe',5,7,1,'?','#8B4513','2025-10-18 04:09:06','2025-10-18 04:09:06'),(61,'Lehrbücher','Kampfsport-Lehrbücher und Anleitungen',6,1,1,'?','#34495E','2025-10-18 04:09:06','2025-10-18 04:09:06'),(62,'DVDs','Trainings-DVDs und Videos',6,2,1,'?','#2C3E50','2025-10-18 04:09:06','2025-10-18 04:09:06'),(63,'Online-Kurse','Digitale Trainingskurse',6,3,1,'?','#3498DB','2025-10-18 04:09:06','2025-10-18 04:09:06'),(64,'Poster','Kampfsport-Poster und Charts',6,4,1,'?️','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(65,'Zertifikate','Urkunden und Zertifikate',6,5,1,'?','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(66,'Zeitschriften','Kampfsport-Magazine',6,6,1,'?','#95A5A6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(71,'Farbgürtel','Farbige Gürtel für verschiedene Grade',7,1,1,'?️','#FFD700','2025-10-18 04:09:06','2025-10-18 04:09:06'),(72,'Schwarze Gürtel','Schwarze Gürtel und Dan-Grade',7,2,1,'⚫','#2C3E50','2025-10-18 04:09:06','2025-10-18 04:09:06'),(73,'Gürtelhalter','Gürtelhalter und Aufbewahrung',7,3,1,'?','#95A5A6','2025-10-18 04:09:06','2025-10-18 04:09:06'),(74,'Urkunden','Graduierungsurkunden',7,4,1,'?','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(81,'Erste-Hilfe-Sets','Komplette Erste-Hilfe-Sets',8,1,1,'?','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(82,'Eisbeutel','Kühlbeutel und Eisbeutel',8,2,1,'?','#3498DB','2025-10-18 04:09:06','2025-10-18 04:09:06'),(83,'Bandagen','Verbandsmaterial und Bandagen',8,3,1,'?','#E67E22','2025-10-18 04:09:06','2025-10-18 04:09:06'),(84,'Desinfektionsmittel','Desinfektionsmittel und Reiniger',8,4,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(91,'Gi-Reiniger','Spezielle Reiniger für Kampfsport-Bekleidung',9,1,1,'?','#2ECC71','2025-10-18 04:09:06','2025-10-18 04:09:06'),(92,'Desinfektionsmittel','Desinfektionsmittel für Ausrüstung',9,2,1,'?','#3498DB','2025-10-18 04:09:06','2025-10-18 04:09:06'),(93,'Geruchsbeseitiger','Geruchsbeseitiger für Schuhe und Ausrüstung',9,3,1,'?','#E91E63','2025-10-18 04:09:06','2025-10-18 04:09:06'),(94,'Pflegemittel','Pflegemittel für Leder und Materialien',9,4,1,'✨','#F39C12','2025-10-18 04:09:06','2025-10-18 04:09:06'),(101,'Sporttaschen','Große Sporttaschen für Ausrüstung',10,1,1,'?','#34495E','2025-10-18 04:09:06','2025-10-18 04:09:06'),(102,'Gi-Taschen','Spezielle Taschen für Gi und Uniformen',10,2,1,'?','#2C3E50','2025-10-18 04:09:06','2025-10-18 04:09:06'),(103,'Handschuh-Taschen','Taschen für Handschuhe und Ausrüstung',10,3,1,'?','#E74C3C','2025-10-18 04:09:06','2025-10-18 04:09:06'),(104,'Waffen-Taschen','Taschen für Trainingswaffen',10,4,1,'⚔️','#8B4513','2025-10-18 04:09:06','2025-10-18 04:09:06');
/*!40000 ALTER TABLE `artikelgruppen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `beitraege`
--

DROP TABLE IF EXISTS `beitraege`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `beitraege` (
  `beitrag_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int DEFAULT NULL,
  `betrag` decimal(7,2) DEFAULT NULL,
  `zahlungsdatum` date DEFAULT (curdate()),
  `zahlungsart` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bezahlt` tinyint(1) DEFAULT '0',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  `magicline_transaction_id` bigint DEFAULT NULL COMMENT 'MagicLine Transaktions-ID',
  `magicline_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MagicLine Transaktionsbeschreibung',
  PRIMARY KEY (`beitrag_id`),
  KEY `mitglied_id` (`mitglied_id`),
  KEY `idx_beitraege_dojo_id` (`dojo_id`),
  KEY `idx_magicline_transaction_id` (`magicline_transaction_id`),
  CONSTRAINT `beitraege_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3168 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `beitraege`
--

LOCK TABLES `beitraege` WRITE;
/*!40000 ALTER TABLE `beitraege` DISABLE KEYS */;
INSERT INTO `beitraege` VALUES (98,64,67.99,'2024-12-16','direct_debit',1,3,1210213900,'Zahllauf-Position M--0026-0000001'),(99,64,67.99,'2024-12-16','direct_debit',1,3,1210213900,'Zahllauf-Position M--0026-0000001'),(100,64,34.99,'2025-01-01','direct_debit',1,3,1210221718,'Zahllauf-Position M--0028-0000011'),(101,64,34.99,'2025-02-01','direct_debit',1,3,1210242133,'Zahllauf-Position M--0030-0000012'),(102,64,34.99,'2025-03-04','direct_debit',1,3,1210265915,'Zahllauf-Position M--0032-0000013'),(103,64,34.99,'2025-04-01','direct_debit',1,3,1210282930,'Zahllauf-Position M--0034-0000013'),(104,64,34.99,'2025-05-02','direct_debit',1,3,1210303320,'Zahllauf-Position M--0035-0000013'),(105,64,34.99,'2025-06-01','direct_debit',1,3,1210321758,'Zahllauf-Position M--0036-0000013'),(106,64,34.99,'2025-07-02','direct_debit',1,3,1210340187,'Zahllauf-Position M--0037-0000013'),(107,64,34.99,'2025-08-01','direct_debit',1,3,1210360655,'Zahllauf-Position M--0040-0000015'),(108,64,34.99,'2025-09-01','direct_debit',1,3,1210377794,'Zahllauf-Position M--0041-0000015'),(109,64,34.99,'2025-10-02','direct_debit',1,3,1210396976,'Zahllauf-Position M--0042-0000015'),(110,64,34.99,'2025-11-01','direct_debit',1,3,1210417470,'Zahllauf-Position M--0043-0000015'),(111,64,34.99,'2025-12-02','direct_debit',1,3,1210440613,'Zahllauf-Position M--0046-0000015'),(112,65,67.99,'2024-12-17','direct_debit',1,3,1210215250,'Zahllauf-Position M--0027-0000001'),(113,65,67.99,'2024-12-17','direct_debit',1,3,1210215250,'Zahllauf-Position M--0027-0000001'),(114,65,34.99,'2025-01-01','direct_debit',1,3,1210221760,'Zahllauf-Position M--0028-0000012'),(115,65,34.99,'2025-02-01','direct_debit',1,3,1210242193,'Zahllauf-Position M--0030-0000013'),(116,65,34.99,'2025-03-04','direct_debit',1,3,1210265910,'Zahllauf-Position M--0032-0000014'),(117,65,34.99,'2025-04-01','direct_debit',1,3,1210282860,'Zahllauf-Position M--0034-0000014'),(118,65,34.99,'2025-05-02','direct_debit',1,3,1210303324,'Zahllauf-Position M--0035-0000014'),(119,65,34.99,'2025-06-01','direct_debit',1,3,1210321752,'Zahllauf-Position M--0036-0000014'),(120,65,34.99,'2025-07-02','direct_debit',1,3,1210340241,'Zahllauf-Position M--0037-0000014'),(121,65,34.99,'2025-08-01','direct_debit',1,3,1210360654,'Zahllauf-Position M--0040-0000016'),(122,65,34.99,'2025-09-01','direct_debit',1,3,1210377796,'Zahllauf-Position M--0041-0000016'),(123,65,34.99,'2025-10-02','direct_debit',1,3,1210397023,'Zahllauf-Position M--0042-0000016'),(124,65,34.99,'2025-11-01','direct_debit',1,3,1210416945,'Zahllauf-Position M--0043-0000016'),(125,65,34.99,'2025-12-02','direct_debit',1,3,1210440567,'Zahllauf-Position M--0046-0000017'),(160,68,73.63,'2025-02-06','direct_debit',1,3,1210249971,'Zahllauf-Position M--0031-0000001'),(161,68,73.63,'2025-02-06','direct_debit',1,3,1210249971,'Zahllauf-Position M--0031-0000001'),(162,68,73.63,'2025-02-06','direct_debit',1,3,1210249971,'Zahllauf-Position M--0031-0000001'),(163,68,34.99,'2025-03-04','direct_debit',1,3,1210265912,'Zahllauf-Position M--0032-0000008'),(164,68,34.99,'2025-04-01','direct_debit',1,3,1210282867,'Zahllauf-Position M--0034-0000008'),(165,68,34.99,'2025-05-02','direct_debit',1,3,1210303329,'Zahllauf-Position M--0035-0000008'),(166,68,34.99,'2025-06-01','direct_debit',1,3,1210321709,'Zahllauf-Position M--0036-0000008'),(167,68,34.99,'2025-07-02','direct_debit',1,3,1210340182,'Zahllauf-Position M--0037-0000008'),(168,68,34.99,'2025-08-01','direct_debit',1,3,1210360650,'Zahllauf-Position M--0040-0000009'),(169,68,34.99,'2025-09-01','direct_debit',1,3,1210377793,'Zahllauf-Position M--0041-0000009'),(170,68,34.99,'2025-10-02','direct_debit',1,3,1210396972,'Zahllauf-Position M--0042-0000009'),(171,68,34.99,'2025-11-01','direct_debit',1,3,1210417472,'Zahllauf-Position M--0043-0000009'),(172,68,34.99,'2025-12-02','direct_debit',1,3,1210440506,'Zahllauf-Position M--0046-0000009'),(173,69,67.99,'2025-02-06','direct_debit',1,3,1210249972,'Zahllauf-Position M--0031-0000003'),(174,69,67.99,'2025-02-06','direct_debit',1,3,1210249972,'Zahllauf-Position M--0031-0000003'),(175,69,34.99,'2025-03-04','direct_debit',1,3,1210265916,'Zahllauf-Position M--0032-0000016'),(176,69,34.99,'2025-04-01','direct_debit',1,3,1210282865,'Zahllauf-Position M--0034-0000016'),(177,69,34.99,'2025-05-02','direct_debit',1,3,1210303222,'Zahllauf-Position M--0035-0000016'),(178,69,34.99,'2025-06-01','direct_debit',1,3,1210321755,'Zahllauf-Position M--0036-0000016'),(179,69,34.99,'2025-07-02','direct_debit',1,3,1210340244,'Zahllauf-Position M--0037-0000016'),(180,69,34.99,'2025-08-01','direct_debit',1,3,1210360729,'Zahllauf-Position M--0040-0000018'),(181,69,34.99,'2025-09-01','direct_debit',1,3,1210377842,'Zahllauf-Position M--0041-0000018'),(182,69,34.99,'2025-10-02','direct_debit',1,3,1210396973,'Zahllauf-Position M--0042-0000018'),(183,69,34.99,'2025-11-01','direct_debit',1,3,1210417425,'Zahllauf-Position M--0043-0000018'),(184,69,34.99,'2025-12-02','direct_debit',1,3,1210440500,'Zahllauf-Position M--0046-0000019'),(209,71,62.35,'2025-03-26','direct_debit',1,3,1210280691,'Zahllauf-Position M--0033-0000002'),(210,71,62.35,'2025-03-26','direct_debit',1,3,1210280691,'Zahllauf-Position M--0033-0000002'),(211,71,34.99,'2025-04-01','direct_debit',1,3,1210282931,'Zahllauf-Position M--0034-0000017'),(212,71,62.35,'2025-03-26','direct_debit',1,3,1210280691,'Zahllauf-Position M--0033-0000002'),(213,71,100.34,'2025-05-02','direct_debit',1,3,1210303228,'Zahllauf-Position M--0035-0000017'),(214,71,100.34,'2025-05-02','direct_debit',1,3,1210303228,'Zahllauf-Position M--0035-0000017'),(215,71,100.34,'2025-05-02','direct_debit',1,3,1210303228,'Zahllauf-Position M--0035-0000017'),(216,71,100.34,'2025-05-02','direct_debit',1,3,1210303228,'Zahllauf-Position M--0035-0000017'),(217,71,34.99,'2025-06-01','direct_debit',1,3,1210321705,'Zahllauf-Position M--0036-0000017'),(218,71,34.99,'2025-07-02','direct_debit',1,3,1210340186,'Zahllauf-Position M--0037-0000017'),(219,71,34.99,'2025-08-01','direct_debit',1,3,1210360653,'Zahllauf-Position M--0040-0000019'),(220,71,34.99,'2025-09-01','direct_debit',1,3,1210377791,'Zahllauf-Position M--0041-0000019'),(221,71,34.99,'2025-10-02','direct_debit',1,3,1210397020,'Zahllauf-Position M--0042-0000019'),(222,71,34.99,'2025-11-01','direct_debit',1,3,1210416944,'Zahllauf-Position M--0043-0000019'),(223,71,34.99,'2025-11-01','direct_debit',1,3,1210416944,'Zahllauf-Position M--0043-0000019'),(224,71,37.99,'2025-11-10','direct_debit',1,3,1210425831,'Zahllauf-Position M--0045-0000003'),(225,71,37.99,'2025-11-10','direct_debit',1,3,1210425831,'Zahllauf-Position M--0045-0000003'),(226,71,34.99,'2025-12-02','direct_debit',1,3,1210440565,'Zahllauf-Position M--0046-0000021'),(227,72,86.02,'2025-03-26','direct_debit',1,3,1210280694,'Zahllauf-Position M--0033-0000004'),(228,72,86.02,'2025-03-26','direct_debit',1,3,1210280694,'Zahllauf-Position M--0033-0000004'),(229,72,86.02,'2025-03-26','direct_debit',1,3,1210280694,'Zahllauf-Position M--0033-0000004'),(230,72,44.99,'2025-04-01','direct_debit',1,3,1210282862,'Zahllauf-Position M--0034-0000019'),(231,72,44.99,'2025-05-02','direct_debit',1,3,1210303221,'Zahllauf-Position M--0035-0000019'),(232,72,44.99,'2025-06-01','direct_debit',1,3,1210321706,'Zahllauf-Position M--0036-0000019'),(233,72,44.99,'2025-07-02','direct_debit',1,3,1210340184,'Zahllauf-Position M--0037-0000019'),(234,72,44.99,'2025-08-01','direct_debit',1,3,1210360721,'Zahllauf-Position M--0040-0000021'),(235,72,44.99,'2025-09-01','direct_debit',1,3,1210377840,'Zahllauf-Position M--0041-0000021'),(236,72,44.99,'2025-10-02','direct_debit',1,3,1210396474,'Zahllauf-Position M--0042-0000021'),(237,72,44.99,'2025-11-01','direct_debit',1,3,1210416942,'Zahllauf-Position M--0043-0000021'),(238,72,44.99,'2025-12-02','direct_debit',1,3,1210440503,'Zahllauf-Position M--0046-0000023'),(251,74,166.52,'2025-07-07','direct_debit',1,3,1210346000,'Zahllauf-Position M--0038-0000001'),(252,74,166.52,'2025-07-07','direct_debit',1,3,1210346000,'Zahllauf-Position M--0038-0000001'),(253,74,166.52,'2025-07-07','direct_debit',1,3,1210346000,'Zahllauf-Position M--0038-0000001'),(254,74,166.52,'2025-07-07','direct_debit',1,3,1210346000,'Zahllauf-Position M--0038-0000001'),(255,74,166.52,'2025-07-07','direct_debit',1,3,1210346000,'Zahllauf-Position M--0038-0000001'),(256,74,214.51,'2025-08-01','direct_debit',1,3,1210360722,'Zahllauf-Position M--0040-0000007'),(257,74,214.51,'2025-08-01','direct_debit',1,3,1210360722,'Zahllauf-Position M--0040-0000007'),(258,74,214.51,'2025-08-01','direct_debit',1,3,1210360722,'Zahllauf-Position M--0040-0000007'),(259,74,214.51,'2025-08-01','direct_debit',1,3,1210360722,'Zahllauf-Position M--0040-0000007'),(260,74,214.51,'2025-08-01','direct_debit',1,3,1210360722,'Zahllauf-Position M--0040-0000007'),(261,74,214.51,'2025-08-01','direct_debit',1,3,1210360722,'Zahllauf-Position M--0040-0000007'),(262,74,44.99,'2025-09-01','direct_debit',1,3,1210377798,'Zahllauf-Position M--0041-0000007'),(263,74,44.99,'2025-10-02','direct_debit',1,3,1210396970,'Zahllauf-Position M--0042-0000007'),(264,74,44.99,'2025-11-01','direct_debit',1,3,1210417421,'Zahllauf-Position M--0043-0000007'),(265,74,44.99,'2025-12-02','direct_debit',1,3,1210440504,'Zahllauf-Position M--0046-0000007'),(266,74,44.99,'2025-12-02','direct_debit',1,3,1210440504,'Zahllauf-Position M--0046-0000007'),(267,74,47.99,'2025-12-05','direct_debit',1,3,1210446147,'Zahllauf-Position M--0047-0000002'),(268,74,47.99,'2025-12-05','direct_debit',1,3,1210446147,'Zahllauf-Position M--0047-0000002'),(269,75,146.13,'2025-07-07','direct_debit',1,3,1210346001,'Zahllauf-Position M--0039-0000001'),(270,75,146.13,'2025-07-07','direct_debit',1,3,1210346001,'Zahllauf-Position M--0039-0000001'),(271,75,146.13,'2025-07-07','direct_debit',1,3,1210346001,'Zahllauf-Position M--0039-0000001'),(272,75,146.13,'2025-07-07','direct_debit',1,3,1210346001,'Zahllauf-Position M--0039-0000001'),(273,75,146.13,'2025-07-07','direct_debit',1,3,1210346001,'Zahllauf-Position M--0039-0000001'),(274,75,34.99,'2025-08-01','direct_debit',1,3,1210360725,'Zahllauf-Position M--0040-0000010'),(275,75,34.99,'2025-09-01','direct_debit',1,3,1210377845,'Zahllauf-Position M--0041-0000010'),(276,75,34.99,'2025-10-02','direct_debit',1,3,1210396473,'Zahllauf-Position M--0042-0000010'),(277,75,34.99,'2025-11-01','direct_debit',1,3,1210417429,'Zahllauf-Position M--0043-0000010'),(278,75,34.99,'2025-12-02','direct_debit',1,3,1210440501,'Zahllauf-Position M--0046-0000010'),(279,76,168.29,'2025-07-07','direct_debit',1,3,1210346002,'Zahllauf-Position M--0039-0000002'),(280,76,168.29,'2025-07-07','direct_debit',1,3,1210346002,'Zahllauf-Position M--0039-0000002'),(281,76,168.29,'2025-07-07','direct_debit',1,3,1210346002,'Zahllauf-Position M--0039-0000002'),(282,76,168.29,'2025-07-07','direct_debit',1,3,1210346002,'Zahllauf-Position M--0039-0000002'),(283,76,168.29,'2025-07-07','direct_debit',1,3,1210346002,'Zahllauf-Position M--0039-0000002'),(284,76,34.99,'2025-08-01','direct_debit',1,3,1210360723,'Zahllauf-Position M--0040-0000014'),(285,76,34.99,'2025-09-01','direct_debit',1,3,1210377846,'Zahllauf-Position M--0041-0000014'),(286,76,34.99,'2025-10-02','direct_debit',1,3,1210396974,'Zahllauf-Position M--0042-0000014'),(287,76,34.99,'2025-11-01','direct_debit',1,3,1210416943,'Zahllauf-Position M--0043-0000014'),(288,76,34.99,'2025-12-02','direct_debit',1,3,1210440611,'Zahllauf-Position M--0046-0000014'),(289,77,191.02,'2025-11-10','direct_debit',1,3,1210425833,'Zahllauf-Position M--0045-0000001'),(290,77,191.02,'2025-11-10','direct_debit',1,3,1210425833,'Zahllauf-Position M--0045-0000001'),(291,77,191.02,'2025-11-10','direct_debit',1,3,1210425833,'Zahllauf-Position M--0045-0000001'),(292,77,191.02,'2025-11-10','direct_debit',1,3,1210425833,'Zahllauf-Position M--0045-0000001'),(293,77,191.02,'2025-11-10','direct_debit',1,3,1210425833,'Zahllauf-Position M--0045-0000001'),(294,77,191.02,'2025-11-10','direct_debit',1,3,1210425833,'Zahllauf-Position M--0045-0000001'),(295,77,34.99,'2025-12-02','direct_debit',1,3,1210440566,'Zahllauf-Position M--0046-0000016'),(296,78,172.96,'2025-11-10','direct_debit',1,3,1210425832,'Zahllauf-Position M--0045-0000002'),(297,78,172.96,'2025-11-10','direct_debit',1,3,1210425832,'Zahllauf-Position M--0045-0000002'),(298,78,172.96,'2025-11-10','direct_debit',1,3,1210425832,'Zahllauf-Position M--0045-0000002'),(299,78,172.96,'2025-11-10','direct_debit',1,3,1210425832,'Zahllauf-Position M--0045-0000002'),(300,78,172.96,'2025-11-10','direct_debit',1,3,1210425832,'Zahllauf-Position M--0045-0000002'),(301,78,34.99,'2025-12-02','direct_debit',1,3,1210440564,'Zahllauf-Position M--0046-0000020'),(302,79,83.63,'2025-12-05','direct_debit',1,3,1210446148,'Zahllauf-Position M--0047-0000007'),(303,79,83.63,'2025-12-05','direct_debit',1,3,1210446148,'Zahllauf-Position M--0047-0000007'),(304,79,83.63,'2025-12-05','direct_debit',1,3,1210446148,'Zahllauf-Position M--0047-0000007'),(305,80,98.00,'2025-12-05','direct_debit',1,3,1210446141,'Zahllauf-Position M--0047-0000009'),(306,80,98.00,'2025-12-05','direct_debit',1,3,1210446141,'Zahllauf-Position M--0047-0000009'),(307,81,102.00,'2025-12-05','direct_debit',1,3,1210446142,'Zahllauf-Position M--0047-0000004'),(308,81,102.00,'2025-12-05','direct_debit',1,3,1210446142,'Zahllauf-Position M--0047-0000004'),(341,83,90.17,'2025-12-05','direct_debit',1,3,1210446145,'Zahllauf-Position M--0047-0000006'),(342,83,90.17,'2025-12-05','direct_debit',1,3,1210446145,'Zahllauf-Position M--0047-0000006'),(343,83,90.17,'2025-12-05','direct_debit',1,3,1210446145,'Zahllauf-Position M--0047-0000006'),(344,84,90.17,'2025-12-05','direct_debit',1,3,1210446140,'Zahllauf-Position M--0047-0000008'),(345,84,90.17,'2025-12-05','direct_debit',1,3,1210446140,'Zahllauf-Position M--0047-0000008'),(346,84,90.17,'2025-12-05','direct_debit',1,3,1210446140,'Zahllauf-Position M--0047-0000008'),(432,87,28.38,'2024-05-20','direct_debit',1,3,1210083953,'Zahllauf-Position M--0016-0000001'),(433,87,54.99,'2024-06-07','direct_debit',1,3,1210093962,'Zahllauf-Position M--0017-0000001'),(434,87,54.99,'2024-07-02','direct_debit',1,3,1210107065,'Zahllauf-Position M--0018-0000001'),(435,87,54.99,'2024-08-05','direct_debit',1,3,1210130616,'Zahllauf-Position M--0019-0000001'),(436,87,54.99,'2024-09-09','direct_debit',1,3,1210151716,'Zahllauf-Position M--0020-0000001'),(437,87,54.99,'2024-10-04','direct_debit',1,3,1210169216,'Zahllauf-Position M--0021-0000001'),(438,87,54.99,'2024-11-06','direct_debit',1,3,1210186365,'Zahllauf-Position M--0022-0000001'),(439,87,54.99,'2024-12-02','direct_debit',1,3,1210201511,'Zahllauf-Position M--0024-0000001'),(440,87,54.99,'2025-01-01','direct_debit',1,3,1210221712,'Zahllauf-Position M--0028-0000001'),(441,87,54.99,'2025-02-01','direct_debit',1,3,1210242191,'Zahllauf-Position M--0030-0000001'),(442,87,54.99,'2025-03-04','direct_debit',1,3,1210265911,'Zahllauf-Position M--0032-0000001'),(443,87,54.99,'2025-04-01','direct_debit',1,3,1210282866,'Zahllauf-Position M--0034-0000001'),(444,87,54.99,'2025-05-02','direct_debit',1,3,1210303225,'Zahllauf-Position M--0035-0000001'),(445,87,54.99,'2025-06-01','direct_debit',1,3,1210321708,'Zahllauf-Position M--0036-0000001'),(446,87,54.99,'2025-07-02','direct_debit',1,3,1210340245,'Zahllauf-Position M--0037-0000001'),(447,87,54.99,'2025-08-01','direct_debit',1,3,1210360728,'Zahllauf-Position M--0040-0000001'),(448,87,54.99,'2025-09-01','direct_debit',1,3,1210377890,'Zahllauf-Position M--0041-0000001'),(449,87,54.99,'2025-10-02','direct_debit',1,3,1210396478,'Zahllauf-Position M--0042-0000001'),(450,87,54.99,'2025-11-01','direct_debit',1,3,1210417473,'Zahllauf-Position M--0043-0000001'),(451,87,54.99,'2025-12-02','direct_debit',1,3,1210440610,'Zahllauf-Position M--0046-0000001'),(452,88,51.06,'2024-05-20','direct_debit',1,3,1210083950,'Zahllauf-Position M--0016-0000002'),(453,88,51.06,'2024-05-20','direct_debit',1,3,1210083950,'Zahllauf-Position M--0016-0000002'),(454,88,34.99,'2024-06-07','direct_debit',1,3,1210093965,'Zahllauf-Position M--0017-0000003'),(455,88,34.99,'2024-07-02','direct_debit',1,3,1210107064,'Zahllauf-Position M--0018-0000003'),(456,88,34.99,'2024-08-05','direct_debit',1,3,1210130614,'Zahllauf-Position M--0019-0000002'),(457,88,34.99,'2024-09-09','direct_debit',1,3,1210151711,'Zahllauf-Position M--0020-0000002'),(458,88,34.99,'2024-10-04','direct_debit',1,3,1210169217,'Zahllauf-Position M--0021-0000002'),(459,88,34.99,'2024-11-06','direct_debit',1,3,1210186366,'Zahllauf-Position M--0022-0000002'),(460,88,34.99,'2024-12-02','direct_debit',1,3,1210201513,'Zahllauf-Position M--0024-0000002'),(461,88,34.99,'2025-01-01','direct_debit',1,3,1210221717,'Zahllauf-Position M--0028-0000002'),(462,88,34.99,'2025-02-01','direct_debit',1,3,1210242136,'Zahllauf-Position M--0030-0000002'),(463,88,34.99,'2025-03-04','direct_debit',1,3,1210265919,'Zahllauf-Position M--0032-0000002'),(464,88,34.99,'2025-04-01','direct_debit',1,3,1210282932,'Zahllauf-Position M--0034-0000002'),(465,88,34.99,'2025-05-02','direct_debit',1,3,1210303223,'Zahllauf-Position M--0035-0000002'),(466,88,34.99,'2025-06-01','direct_debit',1,3,1210321757,'Zahllauf-Position M--0036-0000002'),(467,88,34.99,'2025-07-02','direct_debit',1,3,1210340181,'Zahllauf-Position M--0037-0000002'),(468,88,34.99,'2025-08-01','direct_debit',1,3,1210360657,'Zahllauf-Position M--0040-0000002'),(469,88,34.99,'2025-09-01','direct_debit',1,3,1210377843,'Zahllauf-Position M--0041-0000002'),(470,88,34.99,'2025-10-02','direct_debit',1,3,1210396479,'Zahllauf-Position M--0042-0000002'),(471,88,34.99,'2025-11-01','direct_debit',1,3,1210417426,'Zahllauf-Position M--0043-0000002'),(472,88,34.99,'2025-12-02','direct_debit',1,3,1210440505,'Zahllauf-Position M--0046-0000002'),(473,89,102.98,'2024-05-20','direct_debit',1,3,1210083952,'Zahllauf-Position M--0016-0000003'),(474,89,102.98,'2024-05-20','direct_debit',1,3,1210083952,'Zahllauf-Position M--0016-0000003'),(475,89,102.98,'2024-05-20','direct_debit',1,3,1210083952,'Zahllauf-Position M--0016-0000003'),(476,89,34.99,'2024-06-07','direct_debit',1,3,1210093963,'Zahllauf-Position M--0017-0000004'),(477,89,34.99,'2024-07-02','direct_debit',1,3,1210107069,'Zahllauf-Position M--0018-0000004'),(478,89,34.99,'2024-08-05','direct_debit',1,3,1210130613,'Zahllauf-Position M--0019-0000003'),(479,89,34.99,'2024-09-09','direct_debit',1,3,1210151717,'Zahllauf-Position M--0020-0000003'),(480,89,34.99,'2024-10-04','direct_debit',1,3,1210169214,'Zahllauf-Position M--0021-0000003'),(481,89,34.99,'2024-11-06','direct_debit',1,3,1210186360,'Zahllauf-Position M--0022-0000003'),(482,89,34.99,'2024-12-02','direct_debit',1,3,1210201515,'Zahllauf-Position M--0024-0000003'),(483,89,34.99,'2025-01-01','direct_debit',1,3,1210221719,'Zahllauf-Position M--0028-0000003'),(484,89,34.99,'2025-02-01','direct_debit',1,3,1210242130,'Zahllauf-Position M--0030-0000003'),(485,89,34.99,'2025-03-04','direct_debit',1,3,1210265917,'Zahllauf-Position M--0032-0000003'),(486,89,34.99,'2025-04-01','direct_debit',1,3,1210282674,'Zahllauf-Position M--0034-0000003'),(487,89,34.99,'2025-05-02','direct_debit',1,3,1210303325,'Zahllauf-Position M--0035-0000003'),(488,89,34.99,'2025-06-01','direct_debit',1,3,1210321704,'Zahllauf-Position M--0036-0000003'),(489,89,34.99,'2025-07-02','direct_debit',1,3,1210340189,'Zahllauf-Position M--0037-0000003'),(490,89,34.99,'2025-08-01','direct_debit',1,3,1210360726,'Zahllauf-Position M--0040-0000003'),(491,89,34.99,'2025-09-01','direct_debit',1,3,1210377848,'Zahllauf-Position M--0041-0000003'),(492,89,34.99,'2025-10-02','direct_debit',1,3,1210396971,'Zahllauf-Position M--0042-0000003'),(493,89,34.99,'2025-11-01','direct_debit',1,3,1210416947,'Zahllauf-Position M--0043-0000003'),(494,89,34.99,'2025-12-02','direct_debit',1,3,1210440509,'Zahllauf-Position M--0046-0000003'),(495,90,51.06,'2024-05-20','direct_debit',1,3,1210083951,'Zahllauf-Position M--0016-0000004'),(496,90,51.06,'2024-05-20','direct_debit',1,3,1210083951,'Zahllauf-Position M--0016-0000004'),(497,90,34.99,'2024-06-07','direct_debit',1,3,1210093960,'Zahllauf-Position M--0017-0000005'),(498,90,34.99,'2024-07-02','direct_debit',1,3,1210107066,'Zahllauf-Position M--0018-0000005'),(499,90,34.99,'2024-08-05','direct_debit',1,3,1210130610,'Zahllauf-Position M--0019-0000004'),(500,90,34.99,'2024-09-09','direct_debit',1,3,1210151715,'Zahllauf-Position M--0020-0000004'),(501,90,34.99,'2024-10-04','direct_debit',1,3,1210169210,'Zahllauf-Position M--0021-0000004'),(502,90,34.99,'2024-11-06','direct_debit',1,3,1210186364,'Zahllauf-Position M--0022-0000004'),(503,90,34.99,'2024-12-02','direct_debit',1,3,1210201516,'Zahllauf-Position M--0024-0000004'),(504,90,34.99,'2025-01-01','direct_debit',1,3,1210221710,'Zahllauf-Position M--0028-0000004'),(505,90,34.99,'2025-02-01','direct_debit',1,3,1210242134,'Zahllauf-Position M--0030-0000004'),(506,90,34.99,'2025-03-04','direct_debit',1,3,1210265961,'Zahllauf-Position M--0032-0000004'),(507,90,34.99,'2025-04-01','direct_debit',1,3,1210282675,'Zahllauf-Position M--0034-0000004'),(508,90,34.99,'2025-05-02','direct_debit',1,3,1210303227,'Zahllauf-Position M--0035-0000004'),(509,90,34.99,'2025-06-01','direct_debit',1,3,1210321701,'Zahllauf-Position M--0036-0000004'),(510,90,34.99,'2025-07-02','direct_debit',1,3,1210340242,'Zahllauf-Position M--0037-0000004'),(511,90,34.99,'2025-08-01','direct_debit',1,3,1210360652,'Zahllauf-Position M--0040-0000004'),(512,90,34.99,'2025-09-01','direct_debit',1,3,1210377891,'Zahllauf-Position M--0041-0000004'),(513,90,34.99,'2025-10-02','direct_debit',1,3,1210396979,'Zahllauf-Position M--0042-0000004'),(514,90,34.99,'2025-11-01','direct_debit',1,3,1210417422,'Zahllauf-Position M--0043-0000004'),(515,90,34.99,'2025-12-02','direct_debit',1,3,1210440569,'Zahllauf-Position M--0046-0000004'),(564,93,109.97,'2024-04-03','direct_debit',1,3,1210519770,'Zahllauf-Position 1--0076-0000006'),(565,93,109.97,'2024-04-03','direct_debit',1,3,1210519770,'Zahllauf-Position 1--0076-0000006'),(566,93,109.97,'2024-04-03','direct_debit',1,3,1210519770,'Zahllauf-Position 1--0076-0000006'),(567,93,34.99,'2024-05-03','direct_debit',1,3,1210543210,'Zahllauf-Position 1--0077-0000007'),(568,93,34.99,'2024-06-04','direct_debit',1,3,1210563000,'Zahllauf-Position 1--0078-0000007'),(569,93,34.99,'2024-07-03','direct_debit',1,3,1210585938,'Zahllauf-Position 1--0079-0000057'),(570,93,34.99,'2024-08-05','direct_debit',1,3,1210611822,'Zahllauf-Position 1--0080-0000057'),(571,93,34.99,'2024-09-03','direct_debit',1,3,1210633136,'Zahllauf-Position 1--0081-0000055'),(572,93,34.99,'2024-10-03','direct_debit',1,3,1210653263,'Zahllauf-Position 1--0082-0000052'),(573,93,34.99,'2024-11-05','direct_debit',1,3,1210672084,'Zahllauf-Position 1--0083-0000053'),(574,93,34.99,'2024-12-03','direct_debit',1,3,1210695570,'Zahllauf-Position 1--0084-0000051'),(575,93,34.99,'2025-01-03','direct_debit',1,3,1210715976,'Zahllauf-Position 1--0087-0000049'),(576,93,34.99,'2025-02-04','direct_debit',1,3,1210739345,'Zahllauf-Position 1--0088-0000050'),(577,93,34.99,'2025-03-04','direct_debit',1,3,1210760784,'Zahllauf-Position 1--0089-0000045'),(578,93,34.99,'2025-04-03','direct_debit',1,3,1210791860,'Zahllauf-Position 1--0091-0000047'),(579,93,34.99,'2025-05-05','direct_debit',1,3,1210819537,'Zahllauf-Position 1--0092-0000045'),(580,93,34.99,'2025-06-03','direct_debit',1,3,1210844941,'Zahllauf-Position 1--0093-0000044'),(581,93,34.99,'2025-07-03','direct_debit',1,3,1210869067,'Zahllauf-Position 1--0094-0000044'),(582,93,34.99,'2025-08-05','direct_debit',1,3,1210894038,'Zahllauf-Position 1--0095-0000040'),(583,93,34.99,'2025-09-03','direct_debit',1,3,1210924850,'Zahllauf-Position 1--0096-0000039'),(584,93,34.99,'2025-10-03','direct_debit',1,3,1210956378,'Zahllauf-Position 1--0097-0000036'),(585,93,34.99,'2025-11-04','direct_debit',1,3,1210995916,'Zahllauf-Position 1--0098-0000035'),(586,93,34.99,'2025-12-03','direct_debit',1,3,1211031703,'Zahllauf-Position 1--0099-0000033'),(602,96,96.98,'2024-05-03','direct_debit',1,3,1210543263,'Zahllauf-Position 1--0077-0000045'),(603,96,96.98,'2024-05-03','direct_debit',1,3,1210543263,'Zahllauf-Position 1--0077-0000045'),(604,96,96.98,'2024-05-03','direct_debit',1,3,1210543263,'Zahllauf-Position 1--0077-0000045'),(605,96,44.99,'2024-06-04','direct_debit',1,3,1210563202,'Zahllauf-Position 1--0078-0000044'),(606,96,44.99,'2024-07-03','direct_debit',1,3,1210585787,'Zahllauf-Position 1--0079-0000037'),(607,96,44.99,'2024-08-05','direct_debit',1,3,1210612044,'Zahllauf-Position 1--0080-0000036'),(608,96,44.99,'2024-09-03','direct_debit',1,3,1210633134,'Zahllauf-Position 1--0081-0000034'),(609,96,44.99,'2024-10-03','direct_debit',1,3,1210653113,'Zahllauf-Position 1--0082-0000033'),(610,96,44.99,'2024-11-05','direct_debit',1,3,1210671936,'Zahllauf-Position 1--0083-0000033'),(611,96,44.99,'2024-12-03','direct_debit',1,3,1210695320,'Zahllauf-Position 1--0084-0000031'),(612,96,44.99,'2025-01-03','direct_debit',1,3,1210716024,'Zahllauf-Position 1--0087-0000029'),(613,96,44.99,'2025-02-04','direct_debit',1,3,1210739244,'Zahllauf-Position 1--0088-0000032'),(614,96,44.99,'2025-03-04','direct_debit',1,3,1210760609,'Zahllauf-Position 1--0089-0000030'),(615,96,44.99,'2025-04-03','direct_debit',1,3,1210791762,'Zahllauf-Position 1--0091-0000030'),(616,96,44.99,'2025-05-05','direct_debit',1,3,1210819534,'Zahllauf-Position 1--0092-0000029'),(617,96,44.99,'2025-06-03','direct_debit',1,3,1210845040,'Zahllauf-Position 1--0093-0000029'),(618,96,44.99,'2025-07-03','direct_debit',1,3,1210868917,'Zahllauf-Position 1--0094-0000029'),(619,96,44.99,'2025-08-05','direct_debit',1,3,1210893962,'Zahllauf-Position 1--0095-0000025'),(620,96,44.99,'2025-09-03','direct_debit',1,3,1210924626,'Zahllauf-Position 1--0096-0000024'),(621,96,44.99,'2025-10-03','direct_debit',1,3,1210956326,'Zahllauf-Position 1--0097-0000022'),(622,96,44.99,'2025-11-04','direct_debit',1,3,1210995919,'Zahllauf-Position 1--0098-0000022'),(623,96,44.99,'2025-12-03','direct_debit',1,3,1211031652,'Zahllauf-Position 1--0099-0000020'),(624,97,134.46,'2024-08-05','direct_debit',1,3,1210611989,'Zahllauf-Position 1--0080-0000041'),(625,97,134.46,'2024-08-05','direct_debit',1,3,1210611989,'Zahllauf-Position 1--0080-0000041'),(626,97,134.46,'2024-08-05','direct_debit',1,3,1210611989,'Zahllauf-Position 1--0080-0000041'),(627,97,134.46,'2024-08-05','direct_debit',1,3,1210611989,'Zahllauf-Position 1--0080-0000041'),(628,97,34.99,'2024-09-03','direct_debit',1,3,1210633039,'Zahllauf-Position 1--0081-0000039'),(629,97,34.99,'2024-10-03','direct_debit',1,3,1210653166,'Zahllauf-Position 1--0082-0000036'),(630,97,34.99,'2024-11-05','direct_debit',1,3,1210671984,'Zahllauf-Position 1--0083-0000036'),(631,97,34.99,'2024-12-03','direct_debit',1,3,1210695372,'Zahllauf-Position 1--0084-0000034'),(632,97,34.99,'2025-01-03','direct_debit',1,3,1210716027,'Zahllauf-Position 1--0087-0000032'),(633,97,34.99,'2025-02-04','direct_debit',1,3,1210739245,'Zahllauf-Position 1--0088-0000035'),(634,97,34.99,'2025-03-04','direct_debit',1,3,1210760603,'Zahllauf-Position 1--0089-0000033'),(635,97,34.99,'2025-04-03','direct_debit',1,3,1210791814,'Zahllauf-Position 1--0091-0000033'),(636,97,34.99,'2025-05-05','direct_debit',1,3,1210819406,'Zahllauf-Position 1--0092-0000032'),(637,97,34.99,'2025-06-03','direct_debit',1,3,1210844992,'Zahllauf-Position 1--0093-0000032'),(638,97,34.99,'2025-07-03','direct_debit',1,3,1210869016,'Zahllauf-Position 1--0094-0000032'),(639,97,34.99,'2025-08-05','direct_debit',1,3,1210894034,'Zahllauf-Position 1--0095-0000028'),(640,97,34.99,'2025-09-03','direct_debit',1,3,1210924749,'Zahllauf-Position 1--0096-0000027'),(641,97,34.99,'2025-10-03','direct_debit',1,3,1210956447,'Zahllauf-Position 1--0097-0000025'),(642,97,34.99,'2025-11-04','direct_debit',1,3,1210995991,'Zahllauf-Position 1--0098-0000025'),(643,97,34.99,'2025-12-03','direct_debit',1,3,1211031513,'Zahllauf-Position 1--0099-0000023'),(663,99,92.98,'2024-12-03','direct_debit',1,3,1210695375,'Zahllauf-Position 1--0084-0000054'),(664,99,92.98,'2024-12-03','direct_debit',1,3,1210695375,'Zahllauf-Position 1--0084-0000054'),(665,99,92.98,'2024-12-03','direct_debit',1,3,1210695375,'Zahllauf-Position 1--0084-0000054'),(666,99,29.99,'2025-01-03','direct_debit',1,3,1210715977,'Zahllauf-Position 1--0087-0000051'),(667,99,29.99,'2025-02-04','direct_debit',1,3,1210739397,'Zahllauf-Position 1--0088-0000052'),(668,99,29.99,'2025-03-04','direct_debit',1,3,1210760711,'Zahllauf-Position 1--0089-0000047'),(669,99,29.99,'2025-04-03','direct_debit',1,3,1210791867,'Zahllauf-Position 1--0091-0000049'),(670,99,29.99,'2025-05-05','direct_debit',1,3,1210819488,'Zahllauf-Position 1--0092-0000048'),(671,99,29.99,'2025-06-03','direct_debit',1,3,1210845046,'Zahllauf-Position 1--0093-0000047'),(672,99,29.99,'2025-07-03','direct_debit',1,3,1210869010,'Zahllauf-Position 1--0094-0000047'),(673,99,29.99,'2025-08-05','direct_debit',1,3,1210894140,'Zahllauf-Position 1--0095-0000043'),(674,99,29.99,'2025-09-03','direct_debit',1,3,1210924852,'Zahllauf-Position 1--0096-0000042'),(675,99,29.99,'2025-10-03','direct_debit',1,3,1210956444,'Zahllauf-Position 1--0097-0000039'),(676,99,29.99,'2025-11-04','direct_debit',1,3,1210995990,'Zahllauf-Position 1--0098-0000038'),(677,99,29.99,'2025-12-03','direct_debit',1,3,1211031701,'Zahllauf-Position 1--0099-0000036'),(841,109,62.99,'2022-04-05','direct_debit',1,3,1210038806,'Zahllauf-Position 1--0001-0000009'),(842,109,29.99,'2022-04-12','direct_debit',1,3,1210042231,'Zahllauf-Position 1--0012-0000009'),(843,109,29.99,'2022-05-24','direct_debit',1,3,1210054741,'Zahllauf-Position 1--0016-0000009'),(844,109,29.99,'2022-06-30','direct_debit',1,3,1210070341,'Zahllauf-Position 1--0018-0000009'),(845,109,29.99,'2022-08-02','direct_debit',1,3,1210084515,'Zahllauf-Position 1--0023-0000009'),(846,109,29.99,'2022-08-31','direct_debit',1,3,1210099339,'Zahllauf-Position 1--0026-0000009'),(847,109,29.99,'2022-09-21','direct_debit',1,3,1210111617,'Zahllauf-Position 1--0027-0000009'),(848,109,29.99,'2022-10-04','direct_debit',1,3,1210122565,'Zahllauf-Position 1--0033-0000009'),(849,109,29.99,'2022-11-02','direct_debit',1,3,1210144850,'Zahllauf-Position 1--0036-0000009'),(850,109,29.99,'2022-12-01','direct_debit',1,3,1210165089,'Zahllauf-Position 1--0040-0000009'),(851,109,29.99,'2023-01-03','direct_debit',1,3,1210185794,'Zahllauf-Position 1--0041-0000009'),(852,109,29.99,'2023-02-01','direct_debit',1,3,1210203074,'Zahllauf-Position 1--0043-0000009'),(853,109,29.99,'2023-03-03','direct_debit',1,3,1210220836,'Zahllauf-Position 1--0044-0000009'),(854,109,29.99,'2023-04-01','direct_debit',1,3,1210243953,'Zahllauf-Position 1--0050-0000009'),(855,109,29.99,'2023-05-02','direct_debit',1,3,1210264221,'Zahllauf-Position 1--0052-0000009'),(856,109,29.99,'2023-06-01','direct_debit',1,3,1210282352,'Zahllauf-Position 1--0054-0000009'),(857,109,29.99,'2023-07-03','direct_debit',1,3,1210302024,'Zahllauf-Position 1--0055-0000009'),(858,109,29.99,'2023-08-02','direct_debit',1,3,1210326835,'Zahllauf-Position 1--0057-0000009'),(859,109,29.99,'2023-09-01','direct_debit',1,3,1210345933,'Zahllauf-Position 1--0059-0000009'),(860,109,29.99,'2023-10-05','direct_debit',1,3,1210366814,'Zahllauf-Position 1--0060-0000008'),(861,109,29.99,'2023-11-06','direct_debit',1,3,1210390632,'Zahllauf-Position 1--0062-0000008'),(862,109,29.99,'2023-11-30','direct_debit',1,3,1210412447,'Zahllauf-Position 1--0065-0000008'),(863,109,29.99,'2024-01-05','direct_debit',1,3,1210445863,'Zahllauf-Position 1--0073-0000007'),(864,109,29.99,'2024-02-05','direct_debit',1,3,1210468410,'Zahllauf-Position 1--0074-0000007'),(865,109,29.99,'2024-03-05','direct_debit',1,3,1210495805,'Zahllauf-Position 1--0075-0000006'),(866,109,29.99,'2024-04-03','direct_debit',1,3,1210519922,'Zahllauf-Position 1--0076-0000005'),(867,109,29.99,'2024-05-03','direct_debit',1,3,1210543371,'Zahllauf-Position 1--0077-0000006'),(868,109,29.99,'2024-06-04','direct_debit',1,3,1210563157,'Zahllauf-Position 1--0078-0000006'),(869,109,29.99,'2024-07-03','direct_debit',1,3,1210585931,'Zahllauf-Position 1--0079-0000039'),(870,109,29.99,'2024-08-05','direct_debit',1,3,1210612091,'Zahllauf-Position 1--0080-0000038'),(871,109,29.99,'2024-09-03','direct_debit',1,3,1210633038,'Zahllauf-Position 1--0081-0000036'),(872,109,29.99,'2024-10-03','direct_debit',1,3,1210653114,'Zahllauf-Position 1--0082-0000034'),(873,109,29.99,'2024-11-05','direct_debit',1,3,1210672088,'Zahllauf-Position 1--0083-0000034'),(874,109,29.99,'2024-12-03','direct_debit',1,3,1210695379,'Zahllauf-Position 1--0084-0000032'),(875,109,29.99,'2025-01-03','direct_debit',1,3,1210715924,'Zahllauf-Position 1--0087-0000030'),(876,109,29.99,'2025-02-04','direct_debit',1,3,1210739347,'Zahllauf-Position 1--0088-0000033'),(877,109,29.99,'2025-03-04','direct_debit',1,3,1210760836,'Zahllauf-Position 1--0089-0000031'),(878,109,29.99,'2025-04-03','direct_debit',1,3,1210791862,'Zahllauf-Position 1--0091-0000031'),(879,109,29.99,'2025-05-05','direct_debit',1,3,1210819487,'Zahllauf-Position 1--0092-0000030'),(880,109,29.99,'2025-06-03','direct_debit',1,3,1210844875,'Zahllauf-Position 1--0093-0000030'),(881,109,29.99,'2025-07-03','direct_debit',1,3,1210868969,'Zahllauf-Position 1--0094-0000030'),(882,109,29.99,'2025-08-05','direct_debit',1,3,1210893964,'Zahllauf-Position 1--0095-0000026'),(883,109,29.99,'2025-09-03','direct_debit',1,3,1210924690,'Zahllauf-Position 1--0096-0000025'),(884,109,29.99,'2025-10-03','direct_debit',1,3,1210956278,'Zahllauf-Position 1--0097-0000023'),(885,109,29.99,'2025-11-04','direct_debit',1,3,1210996066,'Zahllauf-Position 1--0098-0000023'),(886,109,29.99,'2025-12-03','direct_debit',1,3,1211031657,'Zahllauf-Position 1--0099-0000021'),(887,109,62.99,'2022-04-05','direct_debit',1,3,1210038806,'Zahllauf-Position 1--0001-0000009'),(897,111,149.95,'2022-08-02','direct_debit',1,3,1210084458,'Zahllauf-Position 1--0023-0000029'),(898,111,149.95,'2022-08-02','direct_debit',1,3,1210084458,'Zahllauf-Position 1--0023-0000029'),(899,111,149.95,'2022-08-02','direct_debit',1,3,1210084458,'Zahllauf-Position 1--0023-0000029'),(900,111,149.95,'2022-08-02','direct_debit',1,3,1210084458,'Zahllauf-Position 1--0023-0000029'),(901,111,149.95,'2022-08-02','direct_debit',1,3,1210084458,'Zahllauf-Position 1--0023-0000029'),(902,111,29.99,'2022-08-31','direct_debit',1,3,1210098454,'Zahllauf-Position 1--0026-0000029'),(903,111,29.99,'2022-09-21','direct_debit',1,3,1210111562,'Zahllauf-Position 1--0027-0000030'),(904,111,29.99,'2022-10-04','direct_debit',1,3,1210122397,'Zahllauf-Position 1--0033-0000030'),(905,111,29.99,'2022-11-02','direct_debit',1,3,1210145081,'Zahllauf-Position 1--0036-0000029'),(906,111,29.99,'2022-12-01','direct_debit',1,3,1210165130,'Zahllauf-Position 1--0040-0000029'),(907,111,29.99,'2023-01-03','direct_debit',1,3,1210185791,'Zahllauf-Position 1--0041-0000029'),(908,111,29.99,'2023-02-01','direct_debit',1,3,1210203185,'Zahllauf-Position 1--0043-0000026'),(909,111,29.99,'2023-03-03','direct_debit',1,3,1210220935,'Zahllauf-Position 1--0044-0000026'),(910,111,29.99,'2023-04-01','direct_debit',1,3,1210243950,'Zahllauf-Position 1--0050-0000026'),(911,111,29.99,'2023-05-02','direct_debit',1,3,1210264070,'Zahllauf-Position 1--0052-0000025'),(912,111,29.99,'2023-06-01','direct_debit',1,3,1210282452,'Zahllauf-Position 1--0054-0000026'),(913,111,29.99,'2023-07-03','direct_debit',1,3,1210302229,'Zahllauf-Position 1--0055-0000025'),(914,111,29.99,'2023-08-02','direct_debit',1,3,1210326678,'Zahllauf-Position 1--0057-0000026'),(915,111,29.99,'2023-09-01','direct_debit',1,3,1210345983,'Zahllauf-Position 1--0059-0000025'),(916,111,29.99,'2023-10-05','direct_debit',1,3,1210366760,'Zahllauf-Position 1--0060-0000024'),(917,111,29.99,'2023-11-06','direct_debit',1,3,1210390631,'Zahllauf-Position 1--0062-0000024'),(918,111,29.99,'2023-11-30','direct_debit',1,3,1210412491,'Zahllauf-Position 1--0065-0000022'),(919,111,29.99,'2024-01-05','direct_debit',1,3,1210446062,'Zahllauf-Position 1--0073-0000030'),(920,111,29.99,'2024-02-05','direct_debit',1,3,1210468412,'Zahllauf-Position 1--0074-0000031'),(921,111,29.99,'2024-03-05','direct_debit',1,3,1210495808,'Zahllauf-Position 1--0075-0000031'),(922,111,29.99,'2024-04-03','direct_debit',1,3,1210519973,'Zahllauf-Position 1--0076-0000030'),(923,111,29.99,'2024-05-03','direct_debit',1,3,1210543219,'Zahllauf-Position 1--0077-0000031'),(924,111,29.99,'2024-06-04','direct_debit',1,3,1210562959,'Zahllauf-Position 1--0078-0000030'),(925,111,29.99,'2024-07-03','direct_debit',1,3,1210585881,'Zahllauf-Position 1--0079-0000049'),(926,111,29.99,'2024-08-05','direct_debit',1,3,1210611265,'Zahllauf-Position 1--0080-0000049'),(927,111,29.99,'2024-09-03','direct_debit',1,3,1210633131,'Zahllauf-Position 1--0081-0000047'),(928,111,29.99,'2024-10-03','direct_debit',1,3,1210653168,'Zahllauf-Position 1--0082-0000044'),(929,111,29.99,'2024-11-05','direct_debit',1,3,1210672034,'Zahllauf-Position 1--0083-0000044'),(930,111,29.99,'2024-12-03','direct_debit',1,3,1210695475,'Zahllauf-Position 1--0084-0000042'),(931,111,29.99,'2025-01-03','direct_debit',1,3,1210715978,'Zahllauf-Position 1--0087-0000040'),(932,111,29.99,'2025-02-04','direct_debit',1,3,1210739393,'Zahllauf-Position 1--0088-0000041'),(933,111,29.99,'2025-03-04','direct_debit',1,3,1210760786,'Zahllauf-Position 1--0089-0000038'),(934,111,29.99,'2025-04-03','direct_debit',1,3,1210791769,'Zahllauf-Position 1--0091-0000038'),(935,111,29.99,'2025-05-05','direct_debit',1,3,1210819485,'Zahllauf-Position 1--0092-0000037'),(936,111,29.99,'2025-06-03','direct_debit',1,3,1210845043,'Zahllauf-Position 1--0093-0000037'),(937,111,29.99,'2025-07-03','direct_debit',1,3,1210868968,'Zahllauf-Position 1--0094-0000037'),(938,111,29.99,'2025-08-05','direct_debit',1,3,1210894099,'Zahllauf-Position 1--0095-0000033'),(939,111,29.99,'2025-09-03','direct_debit',1,3,1210924805,'Zahllauf-Position 1--0096-0000032'),(940,111,29.99,'2025-10-03','direct_debit',1,3,1210956443,'Zahllauf-Position 1--0097-0000030'),(941,111,29.99,'2025-11-04','direct_debit',1,3,1210995913,'Zahllauf-Position 1--0098-0000029'),(942,111,29.99,'2025-12-03','direct_debit',1,3,1211031650,'Zahllauf-Position 1--0099-0000027'),(943,112,29.99,'2022-04-05','direct_debit',1,3,1210038905,'Zahllauf-Position 1--0001-0000006'),(944,112,29.99,'2022-04-12','direct_debit',1,3,1210042306,'Zahllauf-Position 1--0012-0000006'),(945,112,29.99,'2022-05-24','direct_debit',1,3,1210054810,'Zahllauf-Position 1--0016-0000008'),(946,112,29.99,'2022-06-30','direct_debit',1,3,1210070349,'Zahllauf-Position 1--0018-0000008'),(947,112,29.99,'2022-08-02','direct_debit',1,3,1210084451,'Zahllauf-Position 1--0023-0000008'),(948,112,29.99,'2022-08-31','direct_debit',1,3,1210098457,'Zahllauf-Position 1--0026-0000008'),(949,112,29.99,'2022-09-21','direct_debit',1,3,1210111674,'Zahllauf-Position 1--0027-0000008'),(950,112,29.99,'2022-10-04','direct_debit',1,3,1210122390,'Zahllauf-Position 1--0033-0000008'),(951,112,29.99,'2022-11-02','direct_debit',1,3,1210144851,'Zahllauf-Position 1--0036-0000008'),(952,112,29.99,'2022-12-01','direct_debit',1,3,1210165084,'Zahllauf-Position 1--0040-0000008'),(953,112,29.99,'2023-01-03','direct_debit',1,3,1210185795,'Zahllauf-Position 1--0041-0000006'),(954,112,29.99,'2023-02-01','direct_debit',1,3,1210203075,'Zahllauf-Position 1--0043-0000006'),(955,112,29.99,'2023-03-03','direct_debit',1,3,1210220839,'Zahllauf-Position 1--0044-0000006'),(956,112,29.99,'2023-04-01','direct_debit',1,3,1210243954,'Zahllauf-Position 1--0050-0000006'),(957,112,29.99,'2023-05-02','direct_debit',1,3,1210264124,'Zahllauf-Position 1--0052-0000006'),(958,112,29.99,'2023-06-01','direct_debit',1,3,1210282408,'Zahllauf-Position 1--0054-0000006'),(959,112,29.99,'2023-07-03','direct_debit',1,3,1210302022,'Zahllauf-Position 1--0055-0000006'),(960,112,29.99,'2023-08-02','direct_debit',1,3,1210326838,'Zahllauf-Position 1--0057-0000006'),(961,112,29.99,'2023-09-01','direct_debit',1,3,1210345987,'Zahllauf-Position 1--0059-0000006'),(962,112,29.99,'2023-10-05','direct_debit',1,3,1210366712,'Zahllauf-Position 1--0060-0000005'),(963,112,29.99,'2023-11-06','direct_debit',1,3,1210390588,'Zahllauf-Position 1--0062-0000005'),(964,112,29.99,'2023-11-30','direct_debit',1,3,1210412597,'Zahllauf-Position 1--0065-0000005'),(965,112,29.99,'2024-01-05','direct_debit',1,3,1210445812,'Zahllauf-Position 1--0073-0000050'),(966,112,29.99,'2024-02-05','direct_debit',1,3,1210468360,'Zahllauf-Position 1--0074-0000052'),(967,112,29.99,'2024-03-05','direct_debit',1,3,1210495878,'Zahllauf-Position 1--0075-0000054'),(968,112,29.99,'2024-04-03','direct_debit',1,3,1210519920,'Zahllauf-Position 1--0076-0000053'),(969,112,29.99,'2024-05-03','direct_debit',1,3,1210543421,'Zahllauf-Position 1--0077-0000054'),(970,112,29.99,'2024-06-04','direct_debit',1,3,1210563158,'Zahllauf-Position 1--0078-0000053'),(971,112,29.99,'2024-07-03','direct_debit',1,3,1210585936,'Zahllauf-Position 1--0079-0000053'),(972,112,29.99,'2024-08-05','direct_debit',1,3,1210611826,'Zahllauf-Position 1--0080-0000053'),(973,112,29.99,'2024-09-03','direct_debit',1,3,1210633138,'Zahllauf-Position 1--0081-0000051'),(974,112,29.99,'2024-10-03','direct_debit',1,3,1210653261,'Zahllauf-Position 1--0082-0000048'),(975,112,29.99,'2024-11-05','direct_debit',1,3,1210672085,'Zahllauf-Position 1--0083-0000048'),(976,112,29.99,'2024-12-03','direct_debit',1,3,1210695421,'Zahllauf-Position 1--0084-0000046'),(977,112,29.99,'2025-01-03','direct_debit',1,3,1210715879,'Zahllauf-Position 1--0087-0000044'),(978,112,29.99,'2025-02-04','direct_debit',1,3,1210739343,'Zahllauf-Position 1--0088-0000045'),(979,112,29.99,'2025-03-04','direct_debit',1,3,1210760785,'Zahllauf-Position 1--0089-0000040'),(980,112,29.99,'2025-04-03','direct_debit',1,3,1210791817,'Zahllauf-Position 1--0091-0000040'),(981,112,29.99,'2025-05-05','direct_debit',1,3,1210819489,'Zahllauf-Position 1--0092-0000039'),(982,112,29.99,'2025-06-03','direct_debit',1,3,1210844817,'Zahllauf-Position 1--0093-0000038'),(983,112,29.99,'2025-07-03','direct_debit',1,3,1210869012,'Zahllauf-Position 1--0094-0000038'),(984,112,29.99,'2025-08-05','direct_debit',1,3,1210894143,'Zahllauf-Position 1--0095-0000034'),(985,112,29.99,'2025-09-03','direct_debit',1,3,1210924745,'Zahllauf-Position 1--0096-0000033'),(986,112,29.99,'2025-10-03','direct_debit',1,3,1210956374,'Zahllauf-Position 1--0097-0000031'),(987,112,29.99,'2025-11-04','direct_debit',1,3,1210996063,'Zahllauf-Position 1--0098-0000030'),(988,112,29.99,'2025-12-03','direct_debit',1,3,1211031581,'Zahllauf-Position 1--0099-0000028'),(989,116,59.98,'2022-04-12','direct_debit',1,3,1210042234,'Zahllauf-Position 1--0012-0000021'),(990,116,59.98,'2022-04-12','direct_debit',1,3,1210042234,'Zahllauf-Position 1--0012-0000021'),(991,116,29.99,'2022-05-24','direct_debit',1,3,1210054811,'Zahllauf-Position 1--0016-0000020'),(992,116,29.99,'2022-06-30','direct_debit',1,3,1210070344,'Zahllauf-Position 1--0018-0000020'),(993,116,29.99,'2022-08-02','direct_debit',1,3,1210084408,'Zahllauf-Position 1--0023-0000019'),(994,116,29.99,'2022-08-31','direct_debit',1,3,1210099336,'Zahllauf-Position 1--0026-0000019'),(995,116,29.99,'2022-09-21','direct_debit',1,3,1210111720,'Zahllauf-Position 1--0027-0000020'),(996,116,29.99,'2022-10-04','direct_debit',1,3,1210122447,'Zahllauf-Position 1--0033-0000020'),(997,116,29.99,'2022-11-02','direct_debit',1,3,1210144858,'Zahllauf-Position 1--0036-0000020'),(998,116,29.99,'2022-12-01','direct_debit',1,3,1210165085,'Zahllauf-Position 1--0040-0000020'),(999,116,29.99,'2023-01-03','direct_debit',1,3,1210185841,'Zahllauf-Position 1--0041-0000018'),(1000,116,29.99,'2023-02-01','direct_debit',1,3,1210203236,'Zahllauf-Position 1--0043-0000018'),(1001,116,29.99,'2023-03-03','direct_debit',1,3,1210220835,'Zahllauf-Position 1--0044-0000018'),(1002,116,29.99,'2023-04-01','direct_debit',1,3,1210244009,'Zahllauf-Position 1--0050-0000018'),(1003,116,29.99,'2023-05-02','direct_debit',1,3,1210264074,'Zahllauf-Position 1--0052-0000018'),(1004,116,29.99,'2023-06-01','direct_debit',1,3,1210282404,'Zahllauf-Position 1--0054-0000018'),(1005,116,29.99,'2023-07-03','direct_debit',1,3,1210302028,'Zahllauf-Position 1--0055-0000018'),(1006,116,29.99,'2023-08-02','direct_debit',1,3,1210326789,'Zahllauf-Position 1--0057-0000018'),(1007,116,29.99,'2023-09-01','direct_debit',1,3,1210345936,'Zahllauf-Position 1--0059-0000018'),(1008,116,29.99,'2023-10-05','direct_debit',1,3,1210366769,'Zahllauf-Position 1--0060-0000017'),(1009,116,29.99,'2023-11-06','direct_debit',1,3,1210390533,'Zahllauf-Position 1--0062-0000017'),(1010,116,29.99,'2023-11-30','direct_debit',1,3,1210412542,'Zahllauf-Position 1--0065-0000015'),(1011,116,29.99,'2024-01-05','direct_debit',1,3,1210445915,'Zahllauf-Position 1--0073-0000021'),(1012,116,29.99,'2024-02-05','direct_debit',1,3,1210468512,'Zahllauf-Position 1--0074-0000022'),(1013,116,29.99,'2024-03-05','direct_debit',1,3,1210496030,'Zahllauf-Position 1--0075-0000021'),(1014,116,29.99,'2024-04-03','direct_debit',1,3,1210519824,'Zahllauf-Position 1--0076-0000021'),(1015,116,29.99,'2024-05-03','direct_debit',1,3,1210543378,'Zahllauf-Position 1--0077-0000022'),(1016,116,29.99,'2024-06-04','direct_debit',1,3,1210563052,'Zahllauf-Position 1--0078-0000022'),(1017,116,29.99,'2024-07-03','direct_debit',1,3,1210585980,'Zahllauf-Position 1--0079-0000047'),(1018,116,29.99,'2024-08-05','direct_debit',1,3,1210612045,'Zahllauf-Position 1--0080-0000047'),(1019,116,29.99,'2024-09-03','direct_debit',1,3,1210633084,'Zahllauf-Position 1--0081-0000045'),(1020,116,29.99,'2024-10-03','direct_debit',1,3,1210653165,'Zahllauf-Position 1--0082-0000042'),(1021,116,29.99,'2024-11-05','direct_debit',1,3,1210672080,'Zahllauf-Position 1--0083-0000042'),(1022,116,29.99,'2024-12-03','direct_debit',1,3,1210695528,'Zahllauf-Position 1--0084-0000040'),(1023,116,29.99,'2025-01-03','direct_debit',1,3,1210715975,'Zahllauf-Position 1--0087-0000038'),(1024,116,29.99,'2025-02-04','direct_debit',1,3,1210739391,'Zahllauf-Position 1--0088-0000039'),(1025,116,29.99,'2025-03-04','direct_debit',1,3,1210760666,'Zahllauf-Position 1--0089-0000036'),(1026,116,29.99,'2025-04-03','direct_debit',1,3,1210791768,'Zahllauf-Position 1--0091-0000036'),(1027,116,29.99,'2025-05-05','direct_debit',1,3,1210819588,'Zahllauf-Position 1--0092-0000035'),(1028,116,29.99,'2025-06-03','direct_debit',1,3,1210844870,'Zahllauf-Position 1--0093-0000035'),(1029,116,29.99,'2025-07-03','direct_debit',1,3,1210868961,'Zahllauf-Position 1--0094-0000035'),(1030,116,29.99,'2025-08-05','direct_debit',1,3,1210894142,'Zahllauf-Position 1--0095-0000031'),(1031,116,29.99,'2025-09-03','direct_debit',1,3,1210924807,'Zahllauf-Position 1--0096-0000030'),(1032,116,29.99,'2025-10-03','direct_debit',1,3,1210956370,'Zahllauf-Position 1--0097-0000028'),(1033,116,29.99,'2025-11-04','direct_debit',1,3,1210995997,'Zahllauf-Position 1--0098-0000027'),(1034,116,29.99,'2025-12-03','direct_debit',1,3,1211031511,'Zahllauf-Position 1--0099-0000025'),(1035,117,99.98,'2022-04-12','direct_debit',1,3,1210042238,'Zahllauf-Position 1--0012-0000023'),(1036,117,99.98,'2022-04-12','direct_debit',1,3,1210042238,'Zahllauf-Position 1--0012-0000023'),(1037,117,49.99,'2022-05-24','direct_debit',1,3,1210054871,'Zahllauf-Position 1--0016-0000021'),(1038,117,49.99,'2022-06-30','direct_debit',1,3,1210070342,'Zahllauf-Position 1--0018-0000021'),(1039,117,49.99,'2022-08-02','direct_debit',1,3,1210084511,'Zahllauf-Position 1--0023-0000020'),(1040,117,49.99,'2022-08-31','direct_debit',1,3,1210098456,'Zahllauf-Position 1--0026-0000020'),(1041,117,49.99,'2022-09-21','direct_debit',1,3,1210111670,'Zahllauf-Position 1--0027-0000021'),(1042,117,49.99,'2022-10-04','direct_debit',1,3,1210122440,'Zahllauf-Position 1--0033-0000021'),(1043,117,49.99,'2022-11-02','direct_debit',1,3,1210144852,'Zahllauf-Position 1--0036-0000021'),(1044,117,49.99,'2022-12-01','direct_debit',1,3,1210165088,'Zahllauf-Position 1--0040-0000021'),(1045,117,49.99,'2023-01-03','direct_debit',1,3,1210185892,'Zahllauf-Position 1--0041-0000020'),(1046,117,49.99,'2023-02-01','direct_debit',1,3,1210203186,'Zahllauf-Position 1--0043-0000020'),(1047,117,49.99,'2023-03-03','direct_debit',1,3,1210220194,'Zahllauf-Position 1--0044-0000020'),(1048,117,49.99,'2023-04-01','direct_debit',1,3,1210244078,'Zahllauf-Position 1--0050-0000020'),(1049,117,49.99,'2023-05-02','direct_debit',1,3,1210264220,'Zahllauf-Position 1--0052-0000020'),(1050,117,49.99,'2023-06-01','direct_debit',1,3,1210282350,'Zahllauf-Position 1--0054-0000020'),(1051,117,49.99,'2023-07-03','direct_debit',1,3,1210302174,'Zahllauf-Position 1--0055-0000020'),(1052,117,49.99,'2023-08-02','direct_debit',1,3,1210326733,'Zahllauf-Position 1--0057-0000020'),(1053,117,49.99,'2023-09-01','direct_debit',1,3,1210346088,'Zahllauf-Position 1--0059-0000020'),(1054,117,49.99,'2023-10-05','direct_debit',1,3,1210366766,'Zahllauf-Position 1--0060-0000019'),(1055,117,49.99,'2023-11-06','direct_debit',1,3,1210390537,'Zahllauf-Position 1--0062-0000019'),(1056,117,49.99,'2023-11-30','direct_debit',1,3,1210412596,'Zahllauf-Position 1--0065-0000017'),(1057,117,49.99,'2024-01-05','direct_debit',1,3,1210445860,'Zahllauf-Position 1--0073-0000056'),(1058,117,49.99,'2024-02-05','direct_debit',1,3,1210468245,'Zahllauf-Position 1--0074-0000057'),(1059,117,49.99,'2024-03-05','direct_debit',1,3,1210495454,'Zahllauf-Position 1--0075-0000058'),(1060,117,49.99,'2024-04-03','direct_debit',1,3,1210519873,'Zahllauf-Position 1--0076-0000058'),(1061,117,49.99,'2024-05-03','direct_debit',1,3,1210542617,'Zahllauf-Position 1--0077-0000061'),(1062,118,49.98,'2022-04-12','direct_debit',1,3,1210042365,'Zahllauf-Position 1--0012-0000024'),(1063,118,49.98,'2022-04-12','direct_debit',1,3,1210042365,'Zahllauf-Position 1--0012-0000024'),(1064,118,24.99,'2022-05-24','direct_debit',1,3,1210054743,'Zahllauf-Position 1--0016-0000023'),(1065,118,24.99,'2022-06-30','direct_debit',1,3,1210070346,'Zahllauf-Position 1--0018-0000023'),(1066,118,24.99,'2022-08-02','direct_debit',1,3,1210084456,'Zahllauf-Position 1--0023-0000022'),(1067,118,24.99,'2022-08-31','direct_debit',1,3,1210099284,'Zahllauf-Position 1--0026-0000022'),(1068,118,24.99,'2022-09-21','direct_debit',1,3,1210111567,'Zahllauf-Position 1--0027-0000023'),(1069,118,24.99,'2022-10-04','direct_debit',1,3,1210122395,'Zahllauf-Position 1--0033-0000023'),(1070,118,24.99,'2022-11-02','direct_debit',1,3,1210145025,'Zahllauf-Position 1--0036-0000023'),(1071,118,24.99,'2022-12-01','direct_debit',1,3,1210165236,'Zahllauf-Position 1--0040-0000023'),(1072,118,24.99,'2023-01-03','direct_debit',1,3,1210185796,'Zahllauf-Position 1--0041-0000021'),(1073,118,24.99,'2023-02-01','direct_debit',1,3,1210203182,'Zahllauf-Position 1--0043-0000021'),(1074,118,24.99,'2023-03-03','direct_debit',1,3,1210220885,'Zahllauf-Position 1--0044-0000021'),(1075,118,24.99,'2023-04-01','direct_debit',1,3,1210243952,'Zahllauf-Position 1--0050-0000021'),(1076,118,24.99,'2023-05-02','direct_debit',1,3,1210264179,'Zahllauf-Position 1--0052-0000021'),(1077,118,24.99,'2023-06-01','direct_debit',1,3,1210282575,'Zahllauf-Position 1--0054-0000021'),(1078,118,24.99,'2023-07-03','direct_debit',1,3,1210302123,'Zahllauf-Position 1--0055-0000021'),(1079,118,24.99,'2023-08-02','direct_debit',1,3,1210326732,'Zahllauf-Position 1--0057-0000021'),(1080,118,24.99,'2023-09-01','direct_debit',1,3,1210346081,'Zahllauf-Position 1--0059-0000021'),(1081,118,24.99,'2023-10-05','direct_debit',1,3,1210366614,'Zahllauf-Position 1--0060-0000020'),(1082,118,24.99,'2023-11-06','direct_debit',1,3,1210390581,'Zahllauf-Position 1--0062-0000020'),(1083,118,24.99,'2023-11-30','direct_debit',1,3,1210412642,'Zahllauf-Position 1--0065-0000018'),(1084,118,24.99,'2024-01-05','direct_debit',1,3,1210446014,'Zahllauf-Position 1--0073-0000044'),(1085,118,24.99,'2024-02-05','direct_debit',1,3,1210468515,'Zahllauf-Position 1--0074-0000046'),(1086,118,24.99,'2024-03-05','direct_debit',1,3,1210495456,'Zahllauf-Position 1--0075-0000048'),(1087,118,24.99,'2024-04-03','direct_debit',1,3,1210519924,'Zahllauf-Position 1--0076-0000047'),(1088,118,24.99,'2024-05-03','direct_debit',1,3,1210543475,'Zahllauf-Position 1--0077-0000048'),(1089,118,24.99,'2024-06-04','direct_debit',1,3,1210563100,'Zahllauf-Position 1--0078-0000047'),(1090,118,24.99,'2024-07-03','direct_debit',1,3,1210585983,'Zahllauf-Position 1--0079-0000048'),(1091,118,24.99,'2024-08-05','direct_debit',1,3,1210612043,'Zahllauf-Position 1--0080-0000048'),(1092,118,24.99,'2024-09-03','direct_debit',1,3,1210633089,'Zahllauf-Position 1--0081-0000046'),(1093,118,24.99,'2024-10-03','direct_debit',1,3,1210653266,'Zahllauf-Position 1--0082-0000043'),(1094,118,24.99,'2024-11-05','direct_debit',1,3,1210671989,'Zahllauf-Position 1--0083-0000043'),(1095,118,24.99,'2024-12-03','direct_debit',1,3,1210695429,'Zahllauf-Position 1--0084-0000041'),(1096,118,24.99,'2025-01-03','direct_debit',1,3,1210716025,'Zahllauf-Position 1--0087-0000039'),(1097,118,24.99,'2025-02-04','direct_debit',1,3,1210739392,'Zahllauf-Position 1--0088-0000040'),(1098,118,24.99,'2025-03-04','direct_debit',1,3,1210760717,'Zahllauf-Position 1--0089-0000037'),(1099,118,24.99,'2025-04-03','direct_debit',1,3,1210791921,'Zahllauf-Position 1--0091-0000037'),(1100,118,24.99,'2025-05-05','direct_debit',1,3,1210819486,'Zahllauf-Position 1--0092-0000036'),(1101,118,24.99,'2025-06-03','direct_debit',1,3,1210844998,'Zahllauf-Position 1--0093-0000036'),(1102,118,24.99,'2025-07-03','direct_debit',1,3,1210869018,'Zahllauf-Position 1--0094-0000036'),(1103,118,24.99,'2025-08-05','direct_debit',1,3,1210893966,'Zahllauf-Position 1--0095-0000032'),(1104,118,24.99,'2025-09-03','direct_debit',1,3,1210924694,'Zahllauf-Position 1--0096-0000031'),(1105,118,24.99,'2025-10-03','direct_debit',1,3,1210956448,'Zahllauf-Position 1--0097-0000029'),(1106,118,24.99,'2025-11-04','direct_debit',1,3,1210995869,'Zahllauf-Position 1--0098-0000028'),(1107,118,24.99,'2025-12-03','direct_debit',1,3,1211031654,'Zahllauf-Position 1--0099-0000026'),(1155,120,67.99,'2022-04-05','direct_debit',1,3,1210038808,'Zahllauf-Position 1--0001-0000014'),(1156,120,34.99,'2022-04-12','direct_debit',1,3,1210042302,'Zahllauf-Position 1--0012-0000014'),(1157,120,34.99,'2022-05-24','direct_debit',1,3,1210054745,'Zahllauf-Position 1--0016-0000014'),(1158,120,34.99,'2022-06-30','direct_debit',1,3,1210070394,'Zahllauf-Position 1--0018-0000014'),(1159,120,34.99,'2022-08-02','direct_debit',1,3,1210084510,'Zahllauf-Position 1--0023-0000013'),(1160,120,34.99,'2022-08-31','direct_debit',1,3,1210098455,'Zahllauf-Position 1--0026-0000013'),(1161,120,34.99,'2022-09-21','direct_debit',1,3,1210111566,'Zahllauf-Position 1--0027-0000013'),(1162,120,34.99,'2022-10-04','direct_debit',1,3,1210122391,'Zahllauf-Position 1--0033-0000013'),(1163,120,34.99,'2022-11-02','direct_debit',1,3,1210145021,'Zahllauf-Position 1--0036-0000013'),(1164,120,34.99,'2022-12-01','direct_debit',1,3,1210165080,'Zahllauf-Position 1--0040-0000013'),(1165,120,34.99,'2023-01-03','direct_debit',1,3,1210185842,'Zahllauf-Position 1--0041-0000013'),(1166,120,34.99,'2023-02-01','direct_debit',1,3,1210203070,'Zahllauf-Position 1--0043-0000013'),(1167,120,34.99,'2023-03-03','direct_debit',1,3,1210220932,'Zahllauf-Position 1--0044-0000013'),(1168,120,34.99,'2023-04-01','direct_debit',1,3,1210244074,'Zahllauf-Position 1--0050-0000013'),(1169,120,34.99,'2023-05-02','direct_debit',1,3,1210264128,'Zahllauf-Position 1--0052-0000013'),(1170,120,34.99,'2023-06-01','direct_debit',1,3,1210282450,'Zahllauf-Position 1--0054-0000013'),(1171,120,34.99,'2023-07-03','direct_debit',1,3,1210302126,'Zahllauf-Position 1--0055-0000013'),(1172,120,34.99,'2023-08-02','direct_debit',1,3,1210326621,'Zahllauf-Position 1--0057-0000013'),(1173,120,34.99,'2023-09-01','direct_debit',1,3,1210345982,'Zahllauf-Position 1--0059-0000013'),(1174,120,34.99,'2023-10-05','direct_debit',1,3,1210366663,'Zahllauf-Position 1--0060-0000012'),(1175,120,34.99,'2023-11-06','direct_debit',1,3,1210390427,'Zahllauf-Position 1--0062-0000012'),(1176,120,34.99,'2023-11-30','direct_debit',1,3,1210412590,'Zahllauf-Position 1--0065-0000012'),(1177,120,34.99,'2024-01-05','direct_debit',1,3,1210445965,'Zahllauf-Position 1--0073-0000002'),(1178,120,34.99,'2024-02-05','direct_debit',1,3,1210468366,'Zahllauf-Position 1--0074-0000002'),(1179,120,34.99,'2024-03-05','direct_debit',1,3,1210495757,'Zahllauf-Position 1--0075-0000002'),(1180,120,34.99,'2024-04-03','direct_debit',1,3,1210519871,'Zahllauf-Position 1--0076-0000002'),(1181,120,34.99,'2024-05-03','direct_debit',1,3,1210543211,'Zahllauf-Position 1--0077-0000003'),(1182,120,34.99,'2024-06-04','direct_debit',1,3,1210563003,'Zahllauf-Position 1--0078-0000003'),(1183,120,34.99,'2024-07-03','direct_debit',1,3,1210585986,'Zahllauf-Position 1--0079-0000046'),(1184,120,34.99,'2024-08-05','direct_debit',1,3,1210611985,'Zahllauf-Position 1--0080-0000046'),(1185,120,34.99,'2024-09-03','direct_debit',1,3,1210633086,'Zahllauf-Position 1--0081-0000044'),(1186,120,34.99,'2024-10-03','direct_debit',1,3,1210653162,'Zahllauf-Position 1--0082-0000041'),(1187,120,34.99,'2024-11-05','direct_debit',1,3,1210672033,'Zahllauf-Position 1--0083-0000041'),(1188,120,34.99,'2024-12-03','direct_debit',1,3,1210695422,'Zahllauf-Position 1--0084-0000039'),(1189,120,34.99,'2025-01-03','direct_debit',1,3,1210716029,'Zahllauf-Position 1--0087-0000037'),(1190,120,34.99,'2025-02-04','direct_debit',1,3,1210739299,'Zahllauf-Position 1--0088-0000038'),(1191,120,34.99,'2025-03-04','direct_debit',1,3,1210760830,'Zahllauf-Position 1--0089-0000035'),(1192,120,34.99,'2025-04-03','direct_debit',1,3,1210791818,'Zahllauf-Position 1--0091-0000035'),(1193,120,34.99,'2025-05-05','direct_debit',1,3,1210819536,'Zahllauf-Position 1--0092-0000034'),(1194,120,34.99,'2025-06-03','direct_debit',1,3,1210845045,'Zahllauf-Position 1--0093-0000034'),(1195,120,34.99,'2025-07-03','direct_debit',1,3,1210868965,'Zahllauf-Position 1--0094-0000034'),(1196,120,34.99,'2025-08-05','direct_debit',1,3,1210893969,'Zahllauf-Position 1--0095-0000030'),(1197,120,34.99,'2025-09-03','direct_debit',1,3,1210924691,'Zahllauf-Position 1--0096-0000029'),(1198,120,34.99,'2025-10-03','direct_debit',1,3,1210956372,'Zahllauf-Position 1--0097-0000027'),(1199,120,34.99,'2025-11-04','direct_debit',1,3,1210995866,'Zahllauf-Position 1--0098-0000026'),(1200,120,34.99,'2025-12-03','direct_debit',1,3,1211031518,'Zahllauf-Position 1--0099-0000024'),(1201,120,67.99,'2022-04-05','direct_debit',1,3,1210038808,'Zahllauf-Position 1--0001-0000014'),(1492,134,62.99,'2022-04-05','direct_debit',1,3,1210038807,'Zahllauf-Position 1--0001-0000018'),(1493,134,62.99,'2022-04-05','direct_debit',1,3,1210038807,'Zahllauf-Position 1--0001-0000018'),(1494,134,29.99,'2022-04-12','direct_debit',1,3,1210042366,'Zahllauf-Position 1--0012-0000018'),(1495,134,29.99,'2022-05-24','direct_debit',1,3,1210054747,'Zahllauf-Position 1--0016-0000015'),(1496,134,29.99,'2022-06-30','direct_debit',1,3,1210070340,'Zahllauf-Position 1--0018-0000015'),(1497,134,29.99,'2022-08-02','direct_debit',1,3,1210084518,'Zahllauf-Position 1--0023-0000014'),(1498,134,29.99,'2022-08-31','direct_debit',1,3,1210099280,'Zahllauf-Position 1--0026-0000014'),(1499,134,29.99,'2022-09-21','direct_debit',1,3,1210111671,'Zahllauf-Position 1--0027-0000015'),(1500,134,29.99,'2022-10-04','direct_debit',1,3,1210122441,'Zahllauf-Position 1--0033-0000015'),(1501,134,29.99,'2022-11-02','direct_debit',1,3,1210145080,'Zahllauf-Position 1--0036-0000015'),(1502,134,29.99,'2022-12-01','direct_debit',1,3,1210165306,'Zahllauf-Position 1--0040-0000015'),(1503,134,29.99,'2023-01-03','direct_debit',1,3,1210185843,'Zahllauf-Position 1--0041-0000015'),(1504,134,29.99,'2023-02-01','direct_debit',1,3,1210203130,'Zahllauf-Position 1--0043-0000015'),(1505,134,29.99,'2023-03-03','direct_debit',1,3,1210220980,'Zahllauf-Position 1--0044-0000015'),(1506,134,29.99,'2023-04-01','direct_debit',1,3,1210244176,'Zahllauf-Position 1--0050-0000015'),(1507,134,29.99,'2023-05-02','direct_debit',1,3,1210264127,'Zahllauf-Position 1--0052-0000015'),(1508,134,29.99,'2023-06-01','direct_debit',1,3,1210282402,'Zahllauf-Position 1--0054-0000015'),(1509,134,29.99,'2023-07-03','direct_debit',1,3,1210302021,'Zahllauf-Position 1--0055-0000015'),(1510,134,29.99,'2023-08-02','direct_debit',1,3,1210326839,'Zahllauf-Position 1--0057-0000015'),(1511,134,29.99,'2023-09-01','direct_debit',1,3,1210345931,'Zahllauf-Position 1--0059-0000015'),(1512,134,29.99,'2023-10-05','direct_debit',1,3,1210366667,'Zahllauf-Position 1--0060-0000014'),(1513,134,29.99,'2023-11-06','direct_debit',1,3,1210390585,'Zahllauf-Position 1--0062-0000014'),(1514,134,29.99,'2023-11-30','direct_debit',1,3,1210412492,'Zahllauf-Position 1--0065-0000014'),(1515,134,29.99,'2024-01-05','direct_debit',1,3,1210445815,'Zahllauf-Position 1--0073-0000032'),(1516,134,29.99,'2024-02-05','direct_debit',1,3,1210468363,'Zahllauf-Position 1--0074-0000033'),(1517,134,29.99,'2024-03-05','direct_debit',1,3,1210495453,'Zahllauf-Position 1--0075-0000033'),(1518,134,29.99,'2024-04-03','direct_debit',1,3,1210519828,'Zahllauf-Position 1--0076-0000032'),(1519,134,29.99,'2024-05-03','direct_debit',1,3,1210543268,'Zahllauf-Position 1--0077-0000033'),(1520,134,29.99,'2024-06-04','direct_debit',1,3,1210563159,'Zahllauf-Position 1--0078-0000032'),(1521,134,29.99,'2024-07-03','direct_debit',1,3,1210585932,'Zahllauf-Position 1--0079-0000054'),(1522,134,29.99,'2024-08-05','direct_debit',1,3,1210611825,'Zahllauf-Position 1--0080-0000054'),(1523,134,29.99,'2024-09-03','direct_debit',1,3,1210633085,'Zahllauf-Position 1--0081-0000052'),(1524,134,29.99,'2024-10-03','direct_debit',1,3,1210653210,'Zahllauf-Position 1--0082-0000049'),(1525,134,29.99,'2024-11-05','direct_debit',1,3,1210672030,'Zahllauf-Position 1--0083-0000049'),(1526,134,29.99,'2024-12-03','direct_debit',1,3,1210695427,'Zahllauf-Position 1--0084-0000047'),(1527,134,29.99,'2025-01-03','direct_debit',1,3,1210715971,'Zahllauf-Position 1--0087-0000045'),(1528,134,29.99,'2025-02-04','direct_debit',1,3,1210739399,'Zahllauf-Position 1--0088-0000046'),(1529,134,29.99,'2025-03-04','direct_debit',1,3,1210760607,'Zahllauf-Position 1--0089-0000041'),(1530,134,29.99,'2025-04-03','direct_debit',1,3,1210791923,'Zahllauf-Position 1--0091-0000042'),(1531,134,29.99,'2025-05-05','direct_debit',1,3,1210819530,'Zahllauf-Position 1--0092-0000041'),(1532,134,29.99,'2025-06-03','direct_debit',1,3,1210844991,'Zahllauf-Position 1--0093-0000040'),(1533,134,29.99,'2025-07-03','direct_debit',1,3,1210869013,'Zahllauf-Position 1--0094-0000040'),(1534,134,29.99,'2025-08-05','direct_debit',1,3,1210893968,'Zahllauf-Position 1--0095-0000036'),(1535,134,29.99,'2025-09-03','direct_debit',1,3,1210924808,'Zahllauf-Position 1--0096-0000035'),(1536,134,29.99,'2025-10-03','direct_debit',1,3,1210956329,'Zahllauf-Position 1--0097-0000033'),(1537,134,29.99,'2025-11-04','direct_debit',1,3,1210996064,'Zahllauf-Position 1--0098-0000032'),(1538,134,29.99,'2025-12-03','direct_debit',1,3,1211031588,'Zahllauf-Position 1--0099-0000030'),(1673,140,82.99,'2022-09-21','direct_debit',1,3,1210111619,'Zahllauf-Position 1--0027-0000031'),(1674,140,49.99,'2022-10-04','direct_debit',1,3,1210122501,'Zahllauf-Position 1--0033-0000031'),(1675,140,49.99,'2022-11-02','direct_debit',1,3,1210144855,'Zahllauf-Position 1--0036-0000030'),(1676,140,49.99,'2022-12-01','direct_debit',1,3,1210165189,'Zahllauf-Position 1--0040-0000030'),(1677,140,49.99,'2023-01-03','direct_debit',1,3,1210185943,'Zahllauf-Position 1--0041-0000030'),(1678,140,49.99,'2023-02-01','direct_debit',1,3,1210203234,'Zahllauf-Position 1--0043-0000027'),(1679,140,49.99,'2023-03-03','direct_debit',1,3,1210220982,'Zahllauf-Position 1--0044-0000027'),(1680,140,49.99,'2023-04-01','direct_debit',1,3,1210244003,'Zahllauf-Position 1--0050-0000027'),(1681,140,49.99,'2023-05-02','direct_debit',1,3,1210264281,'Zahllauf-Position 1--0052-0000026'),(1682,140,49.99,'2023-06-01','direct_debit',1,3,1210282525,'Zahllauf-Position 1--0054-0000027'),(1683,140,49.99,'2023-07-03','direct_debit',1,3,1210302077,'Zahllauf-Position 1--0055-0000026'),(1684,140,49.99,'2023-08-02','direct_debit',1,3,1210326781,'Zahllauf-Position 1--0057-0000027'),(1685,140,49.99,'2023-09-01','direct_debit',1,3,1210345934,'Zahllauf-Position 1--0059-0000026'),(1686,140,49.99,'2023-10-05','direct_debit',1,3,1210366713,'Zahllauf-Position 1--0060-0000025'),(1687,140,49.99,'2023-11-06','direct_debit',1,3,1210390587,'Zahllauf-Position 1--0062-0000025'),(1688,140,49.99,'2023-11-30','direct_debit',1,3,1210412494,'Zahllauf-Position 1--0065-0000023'),(1689,140,49.99,'2024-01-05','direct_debit',1,3,1210446063,'Zahllauf-Position 1--0073-0000046'),(1690,140,49.99,'2024-02-05','direct_debit',1,3,1210468462,'Zahllauf-Position 1--0074-0000048'),(1691,140,49.99,'2024-03-05','direct_debit',1,3,1210495754,'Zahllauf-Position 1--0075-0000050'),(1692,140,49.99,'2024-04-03','direct_debit',1,3,1210519921,'Zahllauf-Position 1--0076-0000049'),(1693,140,49.99,'2024-05-03','direct_debit',1,3,1210543325,'Zahllauf-Position 1--0077-0000050'),(1694,140,49.99,'2024-06-04','direct_debit',1,3,1210563106,'Zahllauf-Position 1--0078-0000049'),(1695,140,49.99,'2024-07-03','direct_debit',1,3,1210585738,'Zahllauf-Position 1--0079-0000001'),(1696,140,49.99,'2024-08-05','direct_debit',1,3,1210611938,'Zahllauf-Position 1--0080-0000001'),(1697,140,49.99,'2024-09-03','direct_debit',1,3,1210633080,'Zahllauf-Position 1--0081-0000001'),(1698,140,49.99,'2024-10-03','direct_debit',1,3,1210653118,'Zahllauf-Position 1--0082-0000001'),(1699,140,49.99,'2024-11-05','direct_debit',1,3,1210671885,'Zahllauf-Position 1--0083-0000001'),(1700,140,149.97,'2025-02-04','direct_debit',1,3,1210739184,'Zahllauf-Position 1--0088-0000001'),(1701,140,149.97,'2025-02-04','direct_debit',1,3,1210739184,'Zahllauf-Position 1--0088-0000001'),(1702,140,149.97,'2025-02-04','direct_debit',1,3,1210739184,'Zahllauf-Position 1--0088-0000001'),(1703,140,199.96,'2025-03-04','direct_debit',1,3,1210760601,'Zahllauf-Position 1--0089-0000001'),(1704,140,199.96,'2025-03-04','direct_debit',1,3,1210760601,'Zahllauf-Position 1--0089-0000001'),(1705,140,199.96,'2025-03-04','direct_debit',1,3,1210760601,'Zahllauf-Position 1--0089-0000001'),(1706,140,199.96,'2025-03-04','direct_debit',1,3,1210760601,'Zahllauf-Position 1--0089-0000001'),(1707,140,49.99,'2025-04-03','direct_debit',1,3,1210791714,'Zahllauf-Position 1--0091-0000001'),(1708,140,99.98,'2025-05-05','direct_debit',1,3,1210819409,'Zahllauf-Position 1--0092-0000006'),(1709,140,99.98,'2025-05-05','direct_debit',1,3,1210819409,'Zahllauf-Position 1--0092-0000006'),(1710,140,149.97,'2025-06-03','direct_debit',1,3,1210844810,'Zahllauf-Position 1--0093-0000004'),(1711,140,149.97,'2025-06-03','direct_debit',1,3,1210844810,'Zahllauf-Position 1--0093-0000004'),(1712,140,149.97,'2025-06-03','direct_debit',1,3,1210844810,'Zahllauf-Position 1--0093-0000004'),(1713,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1714,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1715,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1716,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1717,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1718,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1719,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1720,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1721,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1722,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1723,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1724,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1725,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1726,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1727,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1728,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1729,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1730,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1731,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1732,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1733,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1734,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1735,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1736,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1737,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1738,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1739,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1740,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1741,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1742,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1743,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1744,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1745,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1746,140,82.99,'2022-09-21','direct_debit',1,3,1210111619,'Zahllauf-Position 1--0027-0000031'),(1747,140,149.97,'2025-02-04','direct_debit',1,3,1210739184,'Zahllauf-Position 1--0088-0000001'),(1748,140,149.97,'2025-02-04','direct_debit',1,3,1210739184,'Zahllauf-Position 1--0088-0000001'),(1749,140,149.97,'2025-02-04','direct_debit',1,3,1210739184,'Zahllauf-Position 1--0088-0000001'),(1750,140,49.99,'2025-04-03','direct_debit',1,3,1210791714,'Zahllauf-Position 1--0091-0000001'),(1751,140,199.96,'2025-03-04','direct_debit',1,3,1210760601,'Zahllauf-Position 1--0089-0000001'),(1752,140,99.98,'2025-05-05','direct_debit',1,3,1210819409,'Zahllauf-Position 1--0092-0000006'),(1753,140,99.98,'2025-05-05','direct_debit',1,3,1210819409,'Zahllauf-Position 1--0092-0000006'),(1754,140,149.97,'2025-06-03','direct_debit',1,3,1210844810,'Zahllauf-Position 1--0093-0000004'),(1755,140,149.97,'2025-06-03','direct_debit',1,3,1210844810,'Zahllauf-Position 1--0093-0000004'),(1756,140,149.97,'2025-06-03','direct_debit',1,3,1210844810,'Zahllauf-Position 1--0093-0000004'),(1757,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1758,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1759,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1760,140,199.96,'2025-07-03','direct_debit',1,3,1210868305,'Zahllauf-Position 1--0094-0000003'),(1761,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1762,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1763,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1764,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1765,140,249.95,'2025-08-05','direct_debit',1,3,1210894035,'Zahllauf-Position 1--0095-0000004'),(1766,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1767,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1768,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1769,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1770,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1771,140,299.94,'2025-09-03','direct_debit',1,3,1210924624,'Zahllauf-Position 1--0096-0000003'),(1772,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1773,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1774,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1775,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1776,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1777,140,299.94,'2025-10-03','direct_debit',1,3,1210956446,'Zahllauf-Position 1--0097-0000005'),(1778,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1779,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1780,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1781,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1782,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1783,140,299.94,'2025-11-04','direct_debit',1,3,1210995914,'Zahllauf-Position 1--0098-0000001'),(1784,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1785,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1786,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1787,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1788,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1789,140,299.94,'2025-12-03','direct_debit',1,3,1211031516,'Zahllauf-Position 1--0099-0000001'),(1851,143,62.33,'2022-09-26','direct_debit',1,3,1210116051,'Zahllauf-Position 1--0029-0000001'),(1852,143,62.33,'2022-09-26','direct_debit',1,3,1210116051,'Zahllauf-Position 1--0029-0000001'),(1853,143,54.99,'2022-10-04','direct_debit',1,3,1210122502,'Zahllauf-Position 1--0033-0000034'),(1854,143,54.99,'2022-11-02','direct_debit',1,3,1210145028,'Zahllauf-Position 1--0036-0000033'),(1855,143,54.99,'2022-12-01','direct_debit',1,3,1210165182,'Zahllauf-Position 1--0040-0000033'),(1856,143,54.99,'2023-01-03','direct_debit',1,3,1210185792,'Zahllauf-Position 1--0041-0000033'),(1857,143,54.99,'2023-02-01','direct_debit',1,3,1210203232,'Zahllauf-Position 1--0043-0000030'),(1858,143,54.99,'2023-03-03','direct_debit',1,3,1210220934,'Zahllauf-Position 1--0044-0000030'),(1859,143,54.99,'2023-04-01','direct_debit',1,3,1210244005,'Zahllauf-Position 1--0050-0000030'),(1860,143,54.99,'2023-05-02','direct_debit',1,3,1210264072,'Zahllauf-Position 1--0052-0000029'),(1861,143,54.99,'2023-06-01','direct_debit',1,3,1210282571,'Zahllauf-Position 1--0054-0000030'),(1862,143,54.99,'2023-07-03','direct_debit',1,3,1210302076,'Zahllauf-Position 1--0055-0000029'),(1863,143,54.99,'2023-08-02','direct_debit',1,3,1210326831,'Zahllauf-Position 1--0057-0000030'),(1864,143,54.99,'2023-09-01','direct_debit',1,3,1210345932,'Zahllauf-Position 1--0059-0000029'),(1865,143,54.99,'2023-10-05','direct_debit',1,3,1210366763,'Zahllauf-Position 1--0060-0000028'),(1866,143,54.99,'2023-11-06','direct_debit',1,3,1210390637,'Zahllauf-Position 1--0062-0000028'),(1867,143,54.99,'2023-11-30','direct_debit',1,3,1210412541,'Zahllauf-Position 1--0065-0000026'),(1868,143,54.99,'2024-01-05','direct_debit',1,3,1210445966,'Zahllauf-Position 1--0073-0000001'),(1869,143,54.99,'2024-02-05','direct_debit',1,3,1210468317,'Zahllauf-Position 1--0074-0000001'),(1870,143,54.99,'2024-03-05','direct_debit',1,3,1210495926,'Zahllauf-Position 1--0075-0000001'),(1871,143,54.99,'2024-04-03','direct_debit',1,3,1210519977,'Zahllauf-Position 1--0076-0000001'),(1872,143,54.99,'2024-05-03','direct_debit',1,3,1210543216,'Zahllauf-Position 1--0077-0000001'),(1873,143,54.99,'2024-06-04','direct_debit',1,3,1210563101,'Zahllauf-Position 1--0078-0000001'),(1874,143,54.99,'2024-07-03','direct_debit',1,3,1210585731,'Zahllauf-Position 1--0079-0000017'),(1875,143,54.99,'2024-08-05','direct_debit',1,3,1210611939,'Zahllauf-Position 1--0080-0000016'),(1876,143,54.99,'2024-09-03','direct_debit',1,3,1210632980,'Zahllauf-Position 1--0081-0000014'),(1877,143,54.99,'2024-10-03','direct_debit',1,3,1210653264,'Zahllauf-Position 1--0082-0000014'),(1878,143,54.99,'2024-11-05','direct_debit',1,3,1210671932,'Zahllauf-Position 1--0083-0000014'),(1879,143,54.99,'2024-12-03','direct_debit',1,3,1210695473,'Zahllauf-Position 1--0084-0000013'),(1880,143,54.99,'2025-01-03','direct_debit',1,3,1210716023,'Zahllauf-Position 1--0087-0000013'),(1881,143,54.99,'2025-02-04','direct_debit',1,3,1210739242,'Zahllauf-Position 1--0088-0000014'),(1882,143,54.99,'2025-03-04','direct_debit',1,3,1210760604,'Zahllauf-Position 1--0089-0000013'),(1883,143,54.99,'2025-04-03','direct_debit',1,3,1210791719,'Zahllauf-Position 1--0091-0000013'),(1884,143,54.99,'2025-05-05','direct_debit',1,3,1210819355,'Zahllauf-Position 1--0092-0000013'),(1885,143,54.99,'2025-06-03','direct_debit',1,3,1210844874,'Zahllauf-Position 1--0093-0000013'),(1886,143,54.99,'2025-07-03','direct_debit',1,3,1210868307,'Zahllauf-Position 1--0094-0000013'),(1887,143,54.99,'2025-08-05','direct_debit',1,3,1210894092,'Zahllauf-Position 1--0095-0000011'),(1888,143,54.99,'2025-09-03','direct_debit',1,3,1210924740,'Zahllauf-Position 1--0096-0000011'),(1889,143,54.99,'2025-10-03','direct_debit',1,3,1210956328,'Zahllauf-Position 1--0097-0000010'),(1890,143,54.99,'2025-11-04','direct_debit',1,3,1210995994,'Zahllauf-Position 1--0098-0000011'),(1891,143,54.99,'2025-12-03','direct_debit',1,3,1211031580,'Zahllauf-Position 1--0099-0000011'),(1921,145,77.32,'2022-10-04','direct_debit',1,3,1210122448,'Zahllauf-Position 1--0033-0000036'),(1922,145,77.32,'2022-10-04','direct_debit',1,3,1210122448,'Zahllauf-Position 1--0033-0000036'),(1923,145,77.32,'2022-10-04','direct_debit',1,3,1210122448,'Zahllauf-Position 1--0033-0000036'),(1924,145,34.99,'2022-11-02','direct_debit',1,3,1210144978,'Zahllauf-Position 1--0036-0000035'),(1925,145,34.99,'2022-12-01','direct_debit',1,3,1210165238,'Zahllauf-Position 1--0040-0000035'),(1926,145,34.99,'2023-01-03','direct_debit',1,3,1210185941,'Zahllauf-Position 1--0041-0000035'),(1927,145,34.99,'2023-02-01','direct_debit',1,3,1210203280,'Zahllauf-Position 1--0043-0000032'),(1928,145,34.99,'2023-03-03','direct_debit',1,3,1210220888,'Zahllauf-Position 1--0044-0000032'),(1929,145,34.99,'2023-04-01','direct_debit',1,3,1210244126,'Zahllauf-Position 1--0050-0000032'),(1930,145,34.99,'2023-05-02','direct_debit',1,3,1210264175,'Zahllauf-Position 1--0052-0000031'),(1931,145,34.99,'2023-06-01','direct_debit',1,3,1210282529,'Zahllauf-Position 1--0054-0000032'),(1932,145,34.99,'2023-07-03','direct_debit',1,3,1210302121,'Zahllauf-Position 1--0055-0000031'),(1933,146,168.46,'2022-10-04','direct_debit',1,3,1210122506,'Zahllauf-Position 1--0033-0000038'),(1934,146,168.46,'2022-10-04','direct_debit',1,3,1210122506,'Zahllauf-Position 1--0033-0000038'),(1935,146,168.46,'2022-10-04','direct_debit',1,3,1210122506,'Zahllauf-Position 1--0033-0000038'),(1936,146,168.46,'2022-10-04','direct_debit',1,3,1210122506,'Zahllauf-Position 1--0033-0000038'),(1937,146,49.99,'2022-11-02','direct_debit',1,3,1210145022,'Zahllauf-Position 1--0036-0000037'),(1938,146,49.99,'2022-12-01','direct_debit',1,3,1210165234,'Zahllauf-Position 1--0040-0000037'),(1939,146,49.99,'2023-01-03','direct_debit',1,3,1210185890,'Zahllauf-Position 1--0041-0000037'),(1940,146,49.99,'2023-02-01','direct_debit',1,3,1210203284,'Zahllauf-Position 1--0043-0000034'),(1941,146,49.99,'2023-03-03','direct_debit',1,3,1210220880,'Zahllauf-Position 1--0044-0000034'),(1942,146,49.99,'2023-04-01','direct_debit',1,3,1210244171,'Zahllauf-Position 1--0050-0000034'),(1943,146,49.99,'2023-05-02','direct_debit',1,3,1210264075,'Zahllauf-Position 1--0052-0000033'),(1944,146,49.99,'2023-06-01','direct_debit',1,3,1210282456,'Zahllauf-Position 1--0054-0000034'),(1945,146,49.99,'2023-07-03','direct_debit',1,3,1210302179,'Zahllauf-Position 1--0055-0000033'),(1946,146,49.99,'2023-08-02','direct_debit',1,3,1210326676,'Zahllauf-Position 1--0057-0000033'),(1947,146,49.99,'2023-09-01','direct_debit',1,3,1210345989,'Zahllauf-Position 1--0059-0000032'),(1948,146,49.99,'2023-10-05','direct_debit',1,3,1210366718,'Zahllauf-Position 1--0060-0000031'),(1949,146,49.99,'2023-11-06','direct_debit',1,3,1210390584,'Zahllauf-Position 1--0062-0000031'),(1950,146,49.99,'2023-11-30','direct_debit',1,3,1210412544,'Zahllauf-Position 1--0065-0000029'),(1951,146,49.99,'2024-01-05','direct_debit',1,3,1210445819,'Zahllauf-Position 1--0073-0000004'),(1952,146,49.99,'2024-02-05','direct_debit',1,3,1210468467,'Zahllauf-Position 1--0074-0000004'),(1953,146,0.23,'2024-11-05','direct_debit',1,3,1210672083,'Zahllauf-Position 1--0083-0000052'),(1954,146,49.99,'2024-12-03','direct_debit',1,3,1210695523,'Zahllauf-Position 1--0084-0000050'),(1955,146,49.99,'2025-01-03','direct_debit',1,3,1210716028,'Zahllauf-Position 1--0087-0000048'),(1956,146,49.99,'2025-02-04','direct_debit',1,3,1210739394,'Zahllauf-Position 1--0088-0000049'),(1957,146,49.99,'2025-03-04','direct_debit',1,3,1210760835,'Zahllauf-Position 1--0089-0000044'),(1958,146,49.99,'2025-04-03','direct_debit',1,3,1210791813,'Zahllauf-Position 1--0091-0000045'),(1959,146,49.99,'2025-05-05','direct_debit',1,3,1210819531,'Zahllauf-Position 1--0092-0000043'),(1960,146,49.99,'2025-06-03','direct_debit',1,3,1210844993,'Zahllauf-Position 1--0093-0000042'),(1961,146,49.99,'2025-07-03','direct_debit',1,3,1210869065,'Zahllauf-Position 1--0094-0000042'),(1962,146,49.99,'2025-08-05','direct_debit',1,3,1210894031,'Zahllauf-Position 1--0095-0000038'),(1963,146,49.99,'2025-09-03','direct_debit',1,3,1210924747,'Zahllauf-Position 1--0096-0000037'),(1996,148,282.95,'2022-10-07','direct_debit',1,3,1210125871,'Zahllauf-Position 1--0035-0000001'),(1997,148,282.95,'2022-10-07','direct_debit',1,3,1210125871,'Zahllauf-Position 1--0035-0000001'),(1998,148,282.95,'2022-10-07','direct_debit',1,3,1210125871,'Zahllauf-Position 1--0035-0000001'),(1999,148,282.95,'2022-10-07','direct_debit',1,3,1210125871,'Zahllauf-Position 1--0035-0000001'),(2000,148,282.95,'2022-10-07','direct_debit',1,3,1210125871,'Zahllauf-Position 1--0035-0000001'),(2001,148,282.95,'2022-10-07','direct_debit',1,3,1210125871,'Zahllauf-Position 1--0035-0000001'),(2002,148,49.99,'2022-11-02','direct_debit',1,3,1210144903,'Zahllauf-Position 1--0036-0000038'),(2003,148,49.99,'2022-12-01','direct_debit',1,3,1210165185,'Zahllauf-Position 1--0040-0000038'),(2004,148,49.99,'2023-01-03','direct_debit',1,3,1210185747,'Zahllauf-Position 1--0041-0000038'),(2005,148,49.99,'2023-02-01','direct_debit',1,3,1210203230,'Zahllauf-Position 1--0043-0000035'),(2006,148,49.99,'2023-03-03','direct_debit',1,3,1210220889,'Zahllauf-Position 1--0044-0000035'),(2007,148,49.99,'2023-04-01','direct_debit',1,3,1210244177,'Zahllauf-Position 1--0050-0000035'),(2008,148,49.99,'2023-05-02','direct_debit',1,3,1210264289,'Zahllauf-Position 1--0052-0000034'),(2009,148,49.99,'2023-06-01','direct_debit',1,3,1210282358,'Zahllauf-Position 1--0054-0000035'),(2010,148,49.99,'2023-07-03','direct_debit',1,3,1210302227,'Zahllauf-Position 1--0055-0000034'),(2011,148,49.99,'2023-08-02','direct_debit',1,3,1210326735,'Zahllauf-Position 1--0057-0000034'),(2012,148,49.99,'2023-09-01','direct_debit',1,3,1210346038,'Zahllauf-Position 1--0059-0000033'),(2013,148,49.99,'2023-10-05','direct_debit',1,3,1210366812,'Zahllauf-Position 1--0060-0000032'),(2014,148,49.99,'2023-11-06','direct_debit',1,3,1210390535,'Zahllauf-Position 1--0062-0000032'),(2015,148,49.99,'2023-11-30','direct_debit',1,3,1210412546,'Zahllauf-Position 1--0065-0000030'),(2016,148,49.99,'2024-01-05','direct_debit',1,3,1210445910,'Zahllauf-Position 1--0073-0000023'),(2017,148,49.99,'2024-02-05','direct_debit',1,3,1210468464,'Zahllauf-Position 1--0074-0000024'),(2018,148,49.99,'2024-03-05','direct_debit',1,3,1210495976,'Zahllauf-Position 1--0075-0000024'),(2019,148,49.99,'2024-04-03','direct_debit',1,3,1210519820,'Zahllauf-Position 1--0076-0000023'),(2020,148,49.99,'2024-05-03','direct_debit',1,3,1210543374,'Zahllauf-Position 1--0077-0000024'),(2021,148,49.99,'2024-06-04','direct_debit',1,3,1210563004,'Zahllauf-Position 1--0078-0000024'),(2022,148,49.99,'2024-07-03','direct_debit',1,3,1210585784,'Zahllauf-Position 1--0079-0000006'),(2023,148,49.99,'2024-08-05','direct_debit',1,3,1210611987,'Zahllauf-Position 1--0080-0000006'),(2024,148,49.99,'2024-09-03','direct_debit',1,3,1210632981,'Zahllauf-Position 1--0081-0000005'),(2025,148,49.99,'2024-10-03','direct_debit',1,3,1210653111,'Zahllauf-Position 1--0082-0000005'),(2026,148,49.99,'2024-11-05','direct_debit',1,3,1210672036,'Zahllauf-Position 1--0083-0000005'),(2027,148,49.99,'2024-12-03','direct_debit',1,3,1210695325,'Zahllauf-Position 1--0084-0000004'),(2028,148,49.99,'2025-01-03','direct_debit',1,3,1210715870,'Zahllauf-Position 1--0087-0000004'),(2029,148,49.99,'2025-02-04','direct_debit',1,3,1210739290,'Zahllauf-Position 1--0088-0000005'),(2030,148,49.99,'2025-03-04','direct_debit',1,3,1210760669,'Zahllauf-Position 1--0089-0000004'),(2031,148,49.99,'2025-04-03','direct_debit',1,3,1210791760,'Zahllauf-Position 1--0091-0000004'),(2032,148,49.99,'2025-05-05','direct_debit',1,3,1210819404,'Zahllauf-Position 1--0092-0000004'),(2033,148,49.99,'2025-06-03','direct_debit',1,3,1210844999,'Zahllauf-Position 1--0093-0000005'),(2034,148,49.99,'2025-07-03','direct_debit',1,3,1210868303,'Zahllauf-Position 1--0094-0000004'),(2035,148,49.99,'2025-08-05','direct_debit',1,3,1210894032,'Zahllauf-Position 1--0095-0000005'),(2036,148,49.99,'2025-09-03','direct_debit',1,3,1210924627,'Zahllauf-Position 1--0096-0000004'),(2037,148,49.99,'2025-10-03','direct_debit',1,3,1210956274,'Zahllauf-Position 1--0097-0000003'),(2038,148,49.99,'2025-11-04','direct_debit',1,3,1210995868,'Zahllauf-Position 1--0098-0000004'),(2039,149,151.03,'2022-10-07','direct_debit',1,3,1210125870,'Zahllauf-Position 1--0035-0000002'),(2040,149,151.03,'2022-10-07','direct_debit',1,3,1210125870,'Zahllauf-Position 1--0035-0000002'),(2041,149,151.03,'2022-10-07','direct_debit',1,3,1210125870,'Zahllauf-Position 1--0035-0000002'),(2042,149,151.03,'2022-10-07','direct_debit',1,3,1210125870,'Zahllauf-Position 1--0035-0000002'),(2043,149,151.03,'2022-10-07','direct_debit',1,3,1210125870,'Zahllauf-Position 1--0035-0000002'),(2044,149,29.99,'2022-11-02','direct_debit',1,3,1210144976,'Zahllauf-Position 1--0036-0000039'),(2045,149,29.99,'2022-12-01','direct_debit',1,3,1210165183,'Zahllauf-Position 1--0040-0000039'),(2046,149,29.99,'2023-01-03','direct_debit',1,3,1210185799,'Zahllauf-Position 1--0041-0000039'),(2047,149,29.99,'2023-02-01','direct_debit',1,3,1210203134,'Zahllauf-Position 1--0043-0000036'),(2048,149,29.99,'2023-03-03','direct_debit',1,3,1210220887,'Zahllauf-Position 1--0044-0000036'),(2049,149,29.99,'2023-04-01','direct_debit',1,3,1210244008,'Zahllauf-Position 1--0050-0000036'),(2050,149,29.99,'2023-05-02','direct_debit',1,3,1210264126,'Zahllauf-Position 1--0052-0000035'),(2051,149,29.99,'2023-06-01','direct_debit',1,3,1210282351,'Zahllauf-Position 1--0054-0000036'),(2052,149,29.99,'2023-07-03','direct_debit',1,3,1210302175,'Zahllauf-Position 1--0055-0000035'),(2053,149,29.99,'2023-08-02','direct_debit',1,3,1210326679,'Zahllauf-Position 1--0057-0000035'),(2054,149,29.99,'2023-09-01','direct_debit',1,3,1210345988,'Zahllauf-Position 1--0059-0000034'),(2055,149,29.99,'2023-10-05','direct_debit',1,3,1210366612,'Zahllauf-Position 1--0060-0000033'),(2056,149,29.99,'2023-11-06','direct_debit',1,3,1210390589,'Zahllauf-Position 1--0062-0000033'),(2057,149,29.99,'2023-11-30','direct_debit',1,3,1210412443,'Zahllauf-Position 1--0065-0000031'),(2058,149,29.99,'2024-01-05','direct_debit',1,3,1210445866,'Zahllauf-Position 1--0073-0000053'),(2059,149,29.99,'2024-02-05','direct_debit',1,3,1210468516,'Zahllauf-Position 1--0074-0000054'),(2060,149,29.99,'2024-03-05','direct_debit',1,3,1210495458,'Zahllauf-Position 1--0075-0000055'),(2061,149,29.99,'2024-04-03','direct_debit',1,3,1210519879,'Zahllauf-Position 1--0076-0000054'),(2062,149,29.99,'2024-05-03','direct_debit',1,3,1210542619,'Zahllauf-Position 1--0077-0000056'),(2063,149,29.99,'2024-06-04','direct_debit',1,3,1210563207,'Zahllauf-Position 1--0078-0000055'),(2064,149,29.99,'2024-07-03','direct_debit',1,3,1210585735,'Zahllauf-Position 1--0079-0000020'),(2065,149,29.99,'2024-08-05','direct_debit',1,3,1210611936,'Zahllauf-Position 1--0080-0000019'),(2066,149,29.99,'2024-09-03','direct_debit',1,3,1210632938,'Zahllauf-Position 1--0081-0000017'),(2067,149,29.99,'2024-10-03','direct_debit',1,3,1210653311,'Zahllauf-Position 1--0082-0000017'),(2068,149,29.99,'2024-11-05','direct_debit',1,3,1210671884,'Zahllauf-Position 1--0083-0000017'),(2069,149,29.99,'2024-12-03','direct_debit',1,3,1210695520,'Zahllauf-Position 1--0084-0000016'),(2070,149,29.99,'2025-01-03','direct_debit',1,3,1210715824,'Zahllauf-Position 1--0087-0000016'),(2071,149,29.99,'2025-02-04','direct_debit',1,3,1210739186,'Zahllauf-Position 1--0088-0000017'),(2072,149,29.99,'2025-03-04','direct_debit',1,3,1210760781,'Zahllauf-Position 1--0089-0000016'),(2073,149,29.99,'2025-04-03','direct_debit',1,3,1210791445,'Zahllauf-Position 1--0091-0000016'),(2074,149,29.99,'2025-05-05','direct_debit',1,3,1210819358,'Zahllauf-Position 1--0092-0000015'),(2075,149,29.99,'2025-06-03','direct_debit',1,3,1210844814,'Zahllauf-Position 1--0093-0000016'),(2076,149,29.99,'2025-07-03','direct_debit',1,3,1210868962,'Zahllauf-Position 1--0094-0000015'),(2077,149,29.99,'2025-08-05','direct_debit',1,3,1210893392,'Zahllauf-Position 1--0095-0000013'),(2078,149,29.99,'2025-09-03','direct_debit',1,3,1210924809,'Zahllauf-Position 1--0096-0000012'),(2079,149,29.99,'2025-10-03','direct_debit',1,3,1210956441,'Zahllauf-Position 1--0097-0000011'),(2080,149,29.99,'2025-11-04','direct_debit',1,3,1210995863,'Zahllauf-Position 1--0098-0000012'),(2081,149,29.99,'2025-12-03','direct_debit',1,3,1211031656,'Zahllauf-Position 1--0099-0000012'),(2144,152,62.89,'2022-11-02','direct_debit',1,3,1210144900,'Zahllauf-Position 1--0036-0000042'),(2145,152,62.89,'2022-11-02','direct_debit',1,3,1210144900,'Zahllauf-Position 1--0036-0000042'),(2146,152,49.99,'2022-12-01','direct_debit',1,3,1210165139,'Zahllauf-Position 1--0040-0000042'),(2147,152,49.99,'2023-01-03','direct_debit',1,3,1210185798,'Zahllauf-Position 1--0041-0000042'),(2148,152,49.99,'2023-02-01','direct_debit',1,3,1210203137,'Zahllauf-Position 1--0043-0000039'),(2149,152,49.99,'2023-03-03','direct_debit',1,3,1210220930,'Zahllauf-Position 1--0044-0000038'),(2150,152,49.99,'2023-04-01','direct_debit',1,3,1210244002,'Zahllauf-Position 1--0050-0000038'),(2151,152,49.99,'2023-05-02','direct_debit',1,3,1210264288,'Zahllauf-Position 1--0052-0000037'),(2152,152,49.99,'2023-06-01','direct_debit',1,3,1210282578,'Zahllauf-Position 1--0054-0000039'),(2153,152,49.99,'2023-07-03','direct_debit',1,3,1210302173,'Zahllauf-Position 1--0055-0000038'),(2154,152,0.06,'2023-10-05','direct_debit',1,3,1210366768,'Zahllauf-Position 1--0060-0000036'),(2155,152,49.99,'2023-11-06','direct_debit',1,3,1210390534,'Zahllauf-Position 1--0062-0000035'),(2156,152,49.99,'2023-11-30','direct_debit',1,3,1210412444,'Zahllauf-Position 1--0065-0000033'),(2157,152,49.99,'2024-01-05','direct_debit',1,3,1210446018,'Zahllauf-Position 1--0073-0000031'),(2158,152,49.99,'2024-02-05','direct_debit',1,3,1210468311,'Zahllauf-Position 1--0074-0000032'),(2159,152,49.99,'2024-03-05','direct_debit',1,3,1210495756,'Zahllauf-Position 1--0075-0000032'),(2160,152,49.99,'2024-04-03','direct_debit',1,3,1210519874,'Zahllauf-Position 1--0076-0000031'),(2161,152,49.99,'2024-05-03','direct_debit',1,3,1210543215,'Zahllauf-Position 1--0077-0000032'),(2162,152,49.99,'2024-06-04','direct_debit',1,3,1210563151,'Zahllauf-Position 1--0078-0000031'),(2163,152,49.99,'2024-07-03','direct_debit',1,3,1210585837,'Zahllauf-Position 1--0079-0000003'),(2164,152,49.99,'2024-08-05','direct_debit',1,3,1210611827,'Zahllauf-Position 1--0080-0000003'),(2165,153,95.89,'2022-11-08','direct_debit',1,3,1210148380,'Zahllauf-Position 1--0037-0000001'),(2166,153,95.89,'2022-11-08','direct_debit',1,3,1210148380,'Zahllauf-Position 1--0037-0000001'),(2167,153,95.89,'2022-11-08','direct_debit',1,3,1210148380,'Zahllauf-Position 1--0037-0000001'),(2168,153,49.99,'2022-12-01','direct_debit',1,3,1210165131,'Zahllauf-Position 1--0040-0000043'),(2169,153,49.99,'2023-01-03','direct_debit',1,3,1210185893,'Zahllauf-Position 1--0041-0000043'),(2170,153,49.99,'2023-02-01','direct_debit',1,3,1210203078,'Zahllauf-Position 1--0043-0000040'),(2171,153,49.99,'2023-03-03','direct_debit',1,3,1210220881,'Zahllauf-Position 1--0044-0000039'),(2172,153,49.99,'2023-04-01','direct_debit',1,3,1210244175,'Zahllauf-Position 1--0050-0000039'),(2173,153,49.99,'2023-05-02','direct_debit',1,3,1210264178,'Zahllauf-Position 1--0052-0000038'),(2174,153,49.99,'2023-06-01','direct_debit',1,3,1210282406,'Zahllauf-Position 1--0054-0000040'),(2175,153,49.99,'2023-07-03','direct_debit',1,3,1210302025,'Zahllauf-Position 1--0055-0000039'),(2176,153,49.99,'2023-08-02','direct_debit',1,3,1210326788,'Zahllauf-Position 1--0057-0000038'),(2177,153,49.99,'2023-09-01','direct_debit',1,3,1210346080,'Zahllauf-Position 1--0059-0000037'),(2178,153,49.99,'2023-10-05','direct_debit',1,3,1210366717,'Zahllauf-Position 1--0060-0000037'),(2179,153,49.99,'2023-11-06','direct_debit',1,3,1210390530,'Zahllauf-Position 1--0062-0000036'),(2180,153,49.99,'2023-11-30','direct_debit',1,3,1210412640,'Zahllauf-Position 1--0065-0000034'),(2181,153,49.99,'2024-01-05','direct_debit',1,3,1210445911,'Zahllauf-Position 1--0073-0000034'),(2182,153,49.99,'2024-02-05','direct_debit',1,3,1210468248,'Zahllauf-Position 1--0074-0000035'),(2183,153,49.99,'2024-03-05','direct_debit',1,3,1210495802,'Zahllauf-Position 1--0075-0000035'),(2184,153,49.99,'2024-04-03','direct_debit',1,3,1210519774,'Zahllauf-Position 1--0076-0000034'),(2185,153,49.99,'2024-05-03','direct_debit',1,3,1210543218,'Zahllauf-Position 1--0077-0000035'),(2186,153,49.99,'2024-06-04','direct_debit',1,3,1210563105,'Zahllauf-Position 1--0078-0000034'),(2187,153,49.99,'2024-07-03','direct_debit',1,3,1210585939,'Zahllauf-Position 1--0079-0000056'),(2188,153,49.99,'2024-08-05','direct_debit',1,3,1210612090,'Zahllauf-Position 1--0080-0000056'),(2189,153,49.99,'2024-09-03','direct_debit',1,3,1210633185,'Zahllauf-Position 1--0081-0000054'),(2190,153,49.99,'2024-10-03','direct_debit',1,3,1210653214,'Zahllauf-Position 1--0082-0000051'),(2191,153,49.99,'2024-11-05','direct_debit',1,3,1210672130,'Zahllauf-Position 1--0083-0000051'),(2192,153,49.99,'2024-12-03','direct_debit',1,3,1210695425,'Zahllauf-Position 1--0084-0000049'),(2193,153,49.99,'2025-01-03','direct_debit',1,3,1210715972,'Zahllauf-Position 1--0087-0000047'),(2194,153,49.99,'2025-02-04','direct_debit',1,3,1210739346,'Zahllauf-Position 1--0088-0000048'),(2195,153,49.99,'2025-03-04','direct_debit',1,3,1210760787,'Zahllauf-Position 1--0089-0000043'),(2196,153,49.99,'2025-04-03','direct_debit',1,3,1210791810,'Zahllauf-Position 1--0091-0000044'),(2197,153,49.99,'2025-05-05','direct_debit',1,3,1210819580,'Zahllauf-Position 1--0092-0000042'),(2198,153,49.99,'2025-06-03','direct_debit',1,3,1210844818,'Zahllauf-Position 1--0093-0000041'),(2199,153,49.99,'2025-07-03','direct_debit',1,3,1210869017,'Zahllauf-Position 1--0094-0000041'),(2200,153,49.99,'2025-08-05','direct_debit',1,3,1210894144,'Zahllauf-Position 1--0095-0000037'),(2201,153,49.99,'2025-09-03','direct_debit',1,3,1210924803,'Zahllauf-Position 1--0096-0000036'),(2202,153,49.99,'2025-10-03','direct_debit',1,3,1210956324,'Zahllauf-Position 1--0097-0000034'),(2203,153,49.99,'2025-11-04','direct_debit',1,3,1210995995,'Zahllauf-Position 1--0098-0000033'),(2204,153,49.99,'2025-12-03','direct_debit',1,3,1211031653,'Zahllauf-Position 1--0099-0000031'),(2397,164,96.73,'2023-03-15','direct_debit',1,3,1210228764,'Zahllauf-Position 1--0045-0000003'),(2398,164,96.73,'2023-03-15','direct_debit',1,3,1210228764,'Zahllauf-Position 1--0045-0000003'),(2399,164,96.73,'2023-03-15','direct_debit',1,3,1210228764,'Zahllauf-Position 1--0045-0000003'),(2400,164,34.99,'2023-04-01','direct_debit',1,3,1210244075,'Zahllauf-Position 1--0050-0000048'),(2401,164,34.99,'2023-05-02','direct_debit',1,3,1210264223,'Zahllauf-Position 1--0052-0000047'),(2402,164,34.99,'2023-06-01','direct_debit',1,3,1210282574,'Zahllauf-Position 1--0054-0000049'),(2403,164,34.99,'2023-07-03','direct_debit',1,3,1210302129,'Zahllauf-Position 1--0055-0000048'),(2404,164,34.99,'2023-08-02','direct_debit',1,3,1210326622,'Zahllauf-Position 1--0057-0000047'),(2405,164,34.99,'2023-09-01','direct_debit',1,3,1210346033,'Zahllauf-Position 1--0059-0000044'),(2406,164,34.99,'2023-10-05','direct_debit',1,3,1210366711,'Zahllauf-Position 1--0060-0000041'),(2407,164,34.99,'2023-11-06','direct_debit',1,3,1210390633,'Zahllauf-Position 1--0062-0000041'),(2408,164,34.99,'2023-11-30','direct_debit',1,3,1210412446,'Zahllauf-Position 1--0065-0000039'),(2409,164,34.99,'2024-01-05','direct_debit',1,3,1210445816,'Zahllauf-Position 1--0073-0000026'),(2410,164,34.99,'2024-02-05','direct_debit',1,3,1210468465,'Zahllauf-Position 1--0074-0000027'),(2411,164,34.99,'2024-03-05','direct_debit',1,3,1210495873,'Zahllauf-Position 1--0075-0000027'),(2412,164,34.99,'2024-04-03','direct_debit',1,3,1210519778,'Zahllauf-Position 1--0076-0000026'),(2413,164,34.99,'2024-05-03','direct_debit',1,3,1210543327,'Zahllauf-Position 1--0077-0000027'),(2414,164,34.99,'2024-06-04','direct_debit',1,3,1210563059,'Zahllauf-Position 1--0078-0000027'),(2415,164,34.99,'2024-07-03','direct_debit',1,3,1210585732,'Zahllauf-Position 1--0079-0000015'),(2416,164,34.99,'2024-08-05','direct_debit',1,3,1210611885,'Zahllauf-Position 1--0080-0000014'),(2417,164,34.99,'2024-09-03','direct_debit',1,3,1210632936,'Zahllauf-Position 1--0081-0000012'),(2418,164,34.99,'2024-10-03','direct_debit',1,3,1210653068,'Zahllauf-Position 1--0082-0000012'),(2419,164,34.99,'2024-11-05','direct_debit',1,3,1210672032,'Zahllauf-Position 1--0083-0000012'),(2420,164,34.99,'2024-12-03','direct_debit',1,3,1210695371,'Zahllauf-Position 1--0084-0000011'),(2421,164,34.99,'2025-01-03','direct_debit',1,3,1210715826,'Zahllauf-Position 1--0087-0000011'),(2422,164,34.99,'2025-02-04','direct_debit',1,3,1210739349,'Zahllauf-Position 1--0088-0000012'),(2423,164,34.99,'2025-03-04','direct_debit',1,3,1210760719,'Zahllauf-Position 1--0089-0000011'),(2424,164,34.99,'2025-04-03','direct_debit',1,3,1210791716,'Zahllauf-Position 1--0091-0000011'),(2425,164,34.99,'2025-05-05','direct_debit',1,3,1210819354,'Zahllauf-Position 1--0092-0000011'),(2426,164,34.99,'2025-06-03','direct_debit',1,3,1210844813,'Zahllauf-Position 1--0093-0000011'),(2427,164,34.99,'2025-07-03','direct_debit',1,3,1210869015,'Zahllauf-Position 1--0094-0000011'),(2428,164,34.99,'2025-08-05','direct_debit',1,3,1210893395,'Zahllauf-Position 1--0095-0000009'),(2429,164,34.99,'2025-09-03','direct_debit',1,3,1210924692,'Zahllauf-Position 1--0096-0000009'),(2430,164,34.99,'2025-10-03','direct_debit',1,3,1210956449,'Zahllauf-Position 1--0097-0000008'),(2431,164,34.99,'2025-11-04','direct_debit',1,3,1210995912,'Zahllauf-Position 1--0098-0000009'),(2432,164,34.99,'2025-12-03','direct_debit',1,3,1211031658,'Zahllauf-Position 1--0099-0000009'),(2453,166,137.97,'2023-03-16','direct_debit',1,3,1210232680,'Zahllauf-Position 1--0047-0000001'),(2454,166,137.97,'2023-03-16','direct_debit',1,3,1210232680,'Zahllauf-Position 1--0047-0000001'),(2455,166,137.97,'2023-03-16','direct_debit',1,3,1210232680,'Zahllauf-Position 1--0047-0000001'),(2456,166,137.97,'2023-03-16','direct_debit',1,3,1210232680,'Zahllauf-Position 1--0047-0000001'),(2457,166,137.97,'2023-03-16','direct_debit',1,3,1210232680,'Zahllauf-Position 1--0047-0000001'),(2491,168,99.48,'2023-07-14','direct_debit',1,3,1210313582,'Zahllauf-Position 1--0056-0000001'),(2492,168,99.48,'2023-07-14','direct_debit',1,3,1210313582,'Zahllauf-Position 1--0056-0000001'),(2493,168,99.48,'2023-07-14','direct_debit',1,3,1210313582,'Zahllauf-Position 1--0056-0000001'),(2494,168,34.99,'2023-08-02','direct_debit',1,3,1210326673,'Zahllauf-Position 1--0057-0000051'),(2495,168,34.99,'2023-09-01','direct_debit',1,3,1210346133,'Zahllauf-Position 1--0059-0000048'),(2496,168,34.99,'2023-10-05','direct_debit',1,3,1210366616,'Zahllauf-Position 1--0060-0000045'),(2497,168,34.99,'2023-11-06','direct_debit',1,3,1210390531,'Zahllauf-Position 1--0062-0000045'),(2498,168,34.99,'2023-11-30','direct_debit',1,3,1210412442,'Zahllauf-Position 1--0065-0000041'),(2499,168,34.99,'2024-01-05','direct_debit',1,3,1210445918,'Zahllauf-Position 1--0073-0000006'),(2500,168,34.99,'2024-02-05','direct_debit',1,3,1210468469,'Zahllauf-Position 1--0074-0000006'),(2501,168,3.39,'2024-03-05','direct_debit',1,3,1210495750,'Zahllauf-Position 1--0075-0000005'),(2502,169,152.96,'2023-08-02','direct_debit',1,3,1210326672,'Zahllauf-Position 1--0057-0000052'),(2503,169,152.96,'2023-08-02','direct_debit',1,3,1210326672,'Zahllauf-Position 1--0057-0000052'),(2504,169,152.96,'2023-08-02','direct_debit',1,3,1210326672,'Zahllauf-Position 1--0057-0000052'),(2505,169,152.96,'2023-08-02','direct_debit',1,3,1210326672,'Zahllauf-Position 1--0057-0000052'),(2506,169,152.96,'2023-08-02','direct_debit',1,3,1210326672,'Zahllauf-Position 1--0057-0000052'),(2507,169,29.99,'2023-09-01','direct_debit',1,3,1210346031,'Zahllauf-Position 1--0059-0000049'),(2508,169,29.99,'2023-10-05','direct_debit',1,3,1210366666,'Zahllauf-Position 1--0060-0000046'),(2509,169,29.99,'2023-11-06','direct_debit',1,3,1210390634,'Zahllauf-Position 1--0062-0000046'),(2510,169,29.99,'2023-11-30','direct_debit',1,3,1210412496,'Zahllauf-Position 1--0065-0000042'),(2511,169,29.99,'2024-01-05','direct_debit',1,3,1210446011,'Zahllauf-Position 1--0073-0000005'),(2512,169,29.99,'2024-02-05','direct_debit',1,3,1210468313,'Zahllauf-Position 1--0074-0000005'),(2513,169,29.99,'2024-03-05','direct_debit',1,3,1210495803,'Zahllauf-Position 1--0075-0000004'),(2514,169,29.99,'2024-04-03','direct_debit',1,3,1210519777,'Zahllauf-Position 1--0076-0000004'),(2515,169,29.99,'2024-05-03','direct_debit',1,3,1210542616,'Zahllauf-Position 1--0077-0000005'),(2516,169,29.99,'2024-06-04','direct_debit',1,3,1210563104,'Zahllauf-Position 1--0078-0000005'),(2517,169,29.99,'2024-07-03','direct_debit',1,3,1210585789,'Zahllauf-Position 1--0079-0000008'),(2518,169,29.99,'2024-08-05','direct_debit',1,3,1210611935,'Zahllauf-Position 1--0080-0000009'),(2519,169,29.99,'2024-09-03','direct_debit',1,3,1210632985,'Zahllauf-Position 1--0081-0000008'),(2520,169,29.99,'2024-10-03','direct_debit',1,3,1210653069,'Zahllauf-Position 1--0082-0000008'),(2521,169,29.99,'2024-11-05','direct_debit',1,3,1210671886,'Zahllauf-Position 1--0083-0000008'),(2522,169,29.99,'2024-12-03','direct_debit',1,3,1210695327,'Zahllauf-Position 1--0084-0000007'),(2523,169,29.99,'2025-01-03','direct_debit',1,3,1210715820,'Zahllauf-Position 1--0087-0000007'),(2524,169,29.99,'2025-02-04','direct_debit',1,3,1210739248,'Zahllauf-Position 1--0088-0000008'),(2525,169,29.99,'2025-03-04','direct_debit',1,3,1210760660,'Zahllauf-Position 1--0089-0000007'),(2526,169,29.99,'2025-04-03','direct_debit',1,3,1210791863,'Zahllauf-Position 1--0091-0000007'),(2527,169,29.99,'2025-05-05','direct_debit',1,3,1210819484,'Zahllauf-Position 1--0092-0000007'),(2528,169,29.99,'2025-06-03','direct_debit',1,3,1210844990,'Zahllauf-Position 1--0093-0000007'),(2529,169,29.99,'2025-07-03','direct_debit',1,3,1210868919,'Zahllauf-Position 1--0094-0000007'),(2530,169,29.99,'2025-08-05','direct_debit',1,3,1210894090,'Zahllauf-Position 1--0095-0000006'),(2531,169,29.99,'2025-09-03','direct_debit',1,3,1210924741,'Zahllauf-Position 1--0096-0000005'),(2532,169,29.99,'2025-10-03','direct_debit',1,3,1210956277,'Zahllauf-Position 1--0097-0000004'),(2533,169,29.99,'2025-11-04','direct_debit',1,3,1210995867,'Zahllauf-Position 1--0098-0000005'),(2534,169,29.99,'2025-12-03','direct_debit',1,3,1211031651,'Zahllauf-Position 1--0099-0000004'),(2535,170,92.98,'2023-10-30','direct_debit',1,3,1210385270,'Zahllauf-Position 1--0061-0000002'),(2536,170,92.98,'2023-10-30','direct_debit',1,3,1210385270,'Zahllauf-Position 1--0061-0000002'),(2537,170,92.98,'2023-10-30','direct_debit',1,3,1210385270,'Zahllauf-Position 1--0061-0000002'),(2538,170,29.99,'2023-11-06','direct_debit',1,3,1210390630,'Zahllauf-Position 1--0062-0000048'),(2539,170,29.99,'2023-11-30','direct_debit',1,3,1210412592,'Zahllauf-Position 1--0065-0000044'),(2540,170,29.99,'2024-01-05','direct_debit',1,3,1210445869,'Zahllauf-Position 1--0073-0000041'),(2541,170,29.99,'2024-02-05','direct_debit',1,3,1210468413,'Zahllauf-Position 1--0074-0000043'),(2542,170,29.99,'2024-03-05','direct_debit',1,3,1210495753,'Zahllauf-Position 1--0075-0000045'),(2543,170,29.99,'2024-04-03','direct_debit',1,3,1210519979,'Zahllauf-Position 1--0076-0000044'),(2544,170,29.99,'2024-05-03','direct_debit',1,3,1210543427,'Zahllauf-Position 1--0077-0000044'),(2545,170,29.99,'2024-06-04','direct_debit',1,3,1210563053,'Zahllauf-Position 1--0078-0000043'),(2546,170,29.99,'2024-07-03','direct_debit',1,3,1210585733,'Zahllauf-Position 1--0079-0000010'),(2547,170,29.99,'2024-08-05','direct_debit',1,3,1210612047,'Zahllauf-Position 1--0080-0000011'),(2548,170,29.99,'2024-09-03','direct_debit',1,3,1210633030,'Zahllauf-Position 1--0081-0000009'),(2549,170,29.99,'2024-10-03','direct_debit',1,3,1210653062,'Zahllauf-Position 1--0082-0000009'),(2550,170,29.99,'2024-11-05','direct_debit',1,3,1210671880,'Zahllauf-Position 1--0083-0000009'),(2551,170,29.99,'2024-12-03','direct_debit',1,3,1210695470,'Zahllauf-Position 1--0084-0000008'),(2552,170,29.99,'2025-01-03','direct_debit',1,3,1210715829,'Zahllauf-Position 1--0087-0000008'),(2553,170,29.99,'2025-02-04','direct_debit',1,3,1210739183,'Zahllauf-Position 1--0088-0000009'),(2554,170,29.99,'2025-03-04','direct_debit',1,3,1210760602,'Zahllauf-Position 1--0089-0000008'),(2555,170,29.99,'2025-04-03','direct_debit',1,3,1210791717,'Zahllauf-Position 1--0091-0000008'),(2556,170,29.99,'2025-05-05','direct_debit',1,3,1210819352,'Zahllauf-Position 1--0092-0000008'),(2557,170,29.99,'2025-06-03','direct_debit',1,3,1210844876,'Zahllauf-Position 1--0093-0000008'),(2558,170,29.99,'2025-07-03','direct_debit',1,3,1210868910,'Zahllauf-Position 1--0094-0000008'),(2559,170,29.99,'2025-08-05','direct_debit',1,3,1210893393,'Zahllauf-Position 1--0095-0000007'),(2560,170,29.99,'2025-09-03','direct_debit',1,3,1210924620,'Zahllauf-Position 1--0096-0000007'),(2561,170,29.99,'2025-10-03','direct_debit',1,3,1210956377,'Zahllauf-Position 1--0097-0000006'),(2562,170,29.99,'2025-11-04','direct_debit',1,3,1210995860,'Zahllauf-Position 1--0098-0000006'),(2563,170,29.99,'2025-12-03','direct_debit',1,3,1211031587,'Zahllauf-Position 1--0099-0000005'),(2576,172,67.98,'2023-11-20','direct_debit',1,3,1210401822,'Zahllauf-Position 1--0063-0000001'),(2577,172,67.98,'2023-11-20','direct_debit',1,3,1210401822,'Zahllauf-Position 1--0063-0000001'),(2578,172,34.99,'2023-11-30','direct_debit',1,3,1210412545,'Zahllauf-Position 1--0065-0000045'),(2579,172,34.99,'2024-01-05','direct_debit',1,3,1210446065,'Zahllauf-Position 1--0073-0000043'),(2580,172,34.99,'2024-02-05','direct_debit',1,3,1210468510,'Zahllauf-Position 1--0074-0000045'),(2581,172,34.99,'2024-03-05','direct_debit',1,3,1210495923,'Zahllauf-Position 1--0075-0000047'),(2582,172,34.99,'2024-04-03','direct_debit',1,3,1210520030,'Zahllauf-Position 1--0076-0000046'),(2583,172,34.99,'2024-05-03','direct_debit',1,3,1210543376,'Zahllauf-Position 1--0077-0000047'),(2584,172,34.99,'2024-06-04','direct_debit',1,3,1210563051,'Zahllauf-Position 1--0078-0000046'),(2585,172,34.99,'2024-07-03','direct_debit',1,3,1210585788,'Zahllauf-Position 1--0079-0000002'),(2586,172,34.99,'2024-08-05','direct_debit',1,3,1210611886,'Zahllauf-Position 1--0080-0000002'),(2587,172,34.99,'2024-09-03','direct_debit',1,3,1210633031,'Zahllauf-Position 1--0081-0000002'),(2588,172,34.99,'2024-10-03','direct_debit',1,3,1210653064,'Zahllauf-Position 1--0082-0000002'),(2589,172,34.99,'2024-11-05','direct_debit',1,3,1210671986,'Zahllauf-Position 1--0083-0000002'),(2590,172,34.99,'2024-12-03','direct_debit',1,3,1210695323,'Zahllauf-Position 1--0084-0000001'),(2591,172,34.99,'2025-01-03','direct_debit',1,3,1210715827,'Zahllauf-Position 1--0087-0000001'),(2592,172,34.99,'2025-02-04','direct_debit',1,3,1210739181,'Zahllauf-Position 1--0088-0000002'),(2593,172,34.99,'2025-03-04','direct_debit',1,3,1210760831,'Zahllauf-Position 1--0089-0000002'),(2594,172,34.99,'2025-04-03','direct_debit',1,3,1210791920,'Zahllauf-Position 1--0091-0000002'),(2595,172,34.99,'2025-05-05','direct_debit',1,3,1210819402,'Zahllauf-Position 1--0092-0000001'),(2596,172,34.99,'2025-06-03','direct_debit',1,3,1210844815,'Zahllauf-Position 1--0093-0000002'),(2597,172,34.99,'2025-07-03','direct_debit',1,3,1210869110,'Zahllauf-Position 1--0094-0000001'),(2598,172,34.99,'2025-08-05','direct_debit',1,3,1210893965,'Zahllauf-Position 1--0095-0000002'),(2599,172,34.99,'2025-09-03','direct_debit',1,3,1210924742,'Zahllauf-Position 1--0096-0000001'),(2600,172,34.99,'2025-10-03','direct_debit',1,3,1210956442,'Zahllauf-Position 1--0097-0000001'),(2601,172,34.99,'2025-11-04','direct_debit',1,3,1210996062,'Zahllauf-Position 1--0098-0000002'),(2602,172,34.99,'2025-12-03','direct_debit',1,3,1211031517,'Zahllauf-Position 1--0099-0000002'),(2603,173,62.15,'2023-11-20','direct_debit',1,3,1210401821,'Zahllauf-Position 1--0063-0000002'),(2604,173,62.15,'2023-11-20','direct_debit',1,3,1210401821,'Zahllauf-Position 1--0063-0000002'),(2605,173,34.99,'2023-11-30','direct_debit',1,3,1210412449,'Zahllauf-Position 1--0065-0000046'),(2606,173,34.99,'2024-01-05','direct_debit',1,3,1210445960,'Zahllauf-Position 1--0073-0000029'),(2607,173,34.99,'2024-02-05','direct_debit',1,3,1210468318,'Zahllauf-Position 1--0074-0000030'),(2608,173,34.99,'2024-03-05','direct_debit',1,3,1210495921,'Zahllauf-Position 1--0075-0000030'),(2609,173,34.99,'2024-04-03','direct_debit',1,3,1210519972,'Zahllauf-Position 1--0076-0000029'),(2610,173,34.99,'2024-05-03','direct_debit',1,3,1210543269,'Zahllauf-Position 1--0077-0000030'),(2611,173,34.99,'2024-06-04','direct_debit',1,3,1210563102,'Zahllauf-Position 1--0078-0000029'),(2612,173,34.99,'2024-07-03','direct_debit',1,3,1210585169,'Zahllauf-Position 1--0079-0000004'),(2613,173,34.99,'2024-08-05','direct_debit',1,3,1210611930,'Zahllauf-Position 1--0080-0000004'),(2614,173,34.99,'2024-09-03','direct_debit',1,3,1210632939,'Zahllauf-Position 1--0081-0000003'),(2615,173,34.99,'2024-10-03','direct_debit',1,3,1210653066,'Zahllauf-Position 1--0082-0000003'),(2616,173,34.99,'2024-11-05','direct_debit',1,3,1210671939,'Zahllauf-Position 1--0083-0000003'),(2617,173,34.99,'2024-12-03','direct_debit',1,3,1210695474,'Zahllauf-Position 1--0084-0000002'),(2618,173,34.99,'2025-01-03','direct_debit',1,3,1210715872,'Zahllauf-Position 1--0087-0000002'),(2619,173,34.99,'2025-02-04','direct_debit',1,3,1210739180,'Zahllauf-Position 1--0088-0000003'),(2620,173,34.99,'2025-03-04','direct_debit',1,3,1210760665,'Zahllauf-Position 1--0089-0000003'),(2621,173,34.99,'2025-04-03','direct_debit',1,3,1210791447,'Zahllauf-Position 1--0091-0000003'),(2622,173,34.99,'2025-05-05','direct_debit',1,3,1210819356,'Zahllauf-Position 1--0092-0000002'),(2623,173,34.99,'2025-06-03','direct_debit',1,3,1210844873,'Zahllauf-Position 1--0093-0000003'),(2624,173,34.99,'2025-07-03','direct_debit',1,3,1210868912,'Zahllauf-Position 1--0094-0000002'),(2625,173,34.99,'2025-08-05','direct_debit',1,3,1210894030,'Zahllauf-Position 1--0095-0000003'),(2626,173,34.99,'2025-09-03','direct_debit',1,3,1210924623,'Zahllauf-Position 1--0096-0000002'),(2627,173,34.99,'2025-10-03','direct_debit',1,3,1210956275,'Zahllauf-Position 1--0097-0000002'),(2628,173,34.99,'2025-11-04','direct_debit',1,3,1210995865,'Zahllauf-Position 1--0098-0000003'),(2629,173,34.99,'2025-12-03','direct_debit',1,3,1211031586,'Zahllauf-Position 1--0099-0000003'),(2630,174,65.32,'2023-11-20','direct_debit',1,3,1210401823,'Zahllauf-Position 1--0063-0000003'),(2631,174,65.32,'2023-11-20','direct_debit',1,3,1210401823,'Zahllauf-Position 1--0063-0000003'),(2632,174,39.99,'2023-11-30','direct_debit',1,3,1210412593,'Zahllauf-Position 1--0065-0000047'),(2633,174,39.99,'2024-01-05','direct_debit',1,3,1210445917,'Zahllauf-Position 1--0073-0000013'),(2634,174,39.99,'2024-02-05','direct_debit',1,3,1210468364,'Zahllauf-Position 1--0074-0000013'),(2635,174,39.99,'2024-03-05','direct_debit',1,3,1210495928,'Zahllauf-Position 1--0075-0000011'),(2636,174,39.99,'2024-04-03','direct_debit',1,3,1210519878,'Zahllauf-Position 1--0076-0000010'),(2637,174,39.99,'2024-05-03','direct_debit',1,3,1210543420,'Zahllauf-Position 1--0077-0000011'),(2638,174,39.99,'2024-06-04','direct_debit',1,3,1210562952,'Zahllauf-Position 1--0078-0000011'),(2639,174,39.99,'2024-07-03','direct_debit',1,3,1210585737,'Zahllauf-Position 1--0079-0000016'),(2640,174,39.99,'2024-08-05','direct_debit',1,3,1210611884,'Zahllauf-Position 1--0080-0000015'),(2641,174,39.99,'2024-09-03','direct_debit',1,3,1210632933,'Zahllauf-Position 1--0081-0000013'),(2642,174,39.99,'2024-10-03','direct_debit',1,3,1210653067,'Zahllauf-Position 1--0082-0000013'),(2643,174,39.99,'2024-11-05','direct_debit',1,3,1210671938,'Zahllauf-Position 1--0083-0000013'),(2644,174,39.99,'2024-12-03','direct_debit',1,3,1210695322,'Zahllauf-Position 1--0084-0000012'),(2645,174,39.99,'2025-01-03','direct_debit',1,3,1210715823,'Zahllauf-Position 1--0087-0000012'),(2646,174,39.99,'2025-02-04','direct_debit',1,3,1210739243,'Zahllauf-Position 1--0088-0000013'),(2647,174,39.99,'2024-12-03','direct_debit',1,3,1210695322,'Zahllauf-Position 1--0084-0000012'),(2648,174,39.99,'2025-01-03','direct_debit',1,3,1210715823,'Zahllauf-Position 1--0087-0000012'),(2649,174,121.68,'2025-03-04','direct_debit',1,3,1210760718,'Zahllauf-Position 1--0089-0000012'),(2650,174,121.68,'2025-03-04','direct_debit',1,3,1210760718,'Zahllauf-Position 1--0089-0000012'),(2651,174,121.68,'2025-03-04','direct_debit',1,3,1210760718,'Zahllauf-Position 1--0089-0000012'),(2652,174,121.68,'2025-03-04','direct_debit',1,3,1210760718,'Zahllauf-Position 1--0089-0000012'),(2653,174,121.68,'2025-03-04','direct_debit',1,3,1210760718,'Zahllauf-Position 1--0089-0000012'),(2654,174,34.99,'2025-04-03','direct_debit',1,3,1210791922,'Zahllauf-Position 1--0091-0000012'),(2655,174,39.99,'2025-02-04','direct_debit',1,3,1210739243,'Zahllauf-Position 1--0088-0000013'),(2656,174,74.98,'2025-05-05','direct_debit',1,3,1210819407,'Zahllauf-Position 1--0092-0000012'),(2657,174,74.98,'2025-05-05','direct_debit',1,3,1210819407,'Zahllauf-Position 1--0092-0000012'),(2658,174,34.99,'2025-06-03','direct_debit',1,3,1210845047,'Zahllauf-Position 1--0093-0000012'),(2659,174,34.99,'2025-07-03','direct_debit',1,3,1210869062,'Zahllauf-Position 1--0094-0000012'),(2660,174,34.99,'2025-08-05','direct_debit',1,3,1210893394,'Zahllauf-Position 1--0095-0000010'),(2661,174,34.99,'2025-09-03','direct_debit',1,3,1210924743,'Zahllauf-Position 1--0096-0000010'),(2662,174,34.99,'2025-10-03','direct_debit',1,3,1210956323,'Zahllauf-Position 1--0097-0000009'),(2663,174,34.99,'2025-11-04','direct_debit',1,3,1210996061,'Zahllauf-Position 1--0098-0000010'),(2664,174,34.99,'2025-12-03','direct_debit',1,3,1211031583,'Zahllauf-Position 1--0099-0000010'),(2665,175,60.98,'2023-11-20','direct_debit',1,3,1210401820,'Zahllauf-Position 1--0063-0000004'),(2666,175,60.98,'2023-11-20','direct_debit',1,3,1210401820,'Zahllauf-Position 1--0063-0000004'),(2667,175,34.99,'2023-11-30','direct_debit',1,3,1210412497,'Zahllauf-Position 1--0065-0000048'),(2668,175,34.99,'2024-01-05','direct_debit',1,3,1210445814,'Zahllauf-Position 1--0073-0000055'),(2669,175,34.99,'2024-02-05','direct_debit',1,3,1210468249,'Zahllauf-Position 1--0074-0000056'),(2670,175,34.99,'2024-03-05','direct_debit',1,3,1210495871,'Zahllauf-Position 1--0075-0000057'),(2671,175,34.99,'2024-04-03','direct_debit',1,3,1210519923,'Zahllauf-Position 1--0076-0000057'),(2672,175,34.99,'2024-05-03','direct_debit',1,3,1210543426,'Zahllauf-Position 1--0077-0000059'),(2673,175,34.99,'2024-06-04','direct_debit',1,3,1210562950,'Zahllauf-Position 1--0078-0000058'),(2674,175,34.99,'2024-07-03','direct_debit',1,3,1210585830,'Zahllauf-Position 1--0079-0000012'),(2675,175,34.99,'2024-08-05','direct_debit',1,3,1210611881,'Zahllauf-Position 1--0080-0000012'),(2676,175,34.99,'2024-09-03','direct_debit',1,3,1210632982,'Zahllauf-Position 1--0081-0000010'),(2677,175,34.99,'2024-10-03','direct_debit',1,3,1210653060,'Zahllauf-Position 1--0082-0000010'),(2678,175,34.99,'2024-11-05','direct_debit',1,3,1210671937,'Zahllauf-Position 1--0083-0000010'),(2679,175,34.99,'2024-12-03','direct_debit',1,3,1210695378,'Zahllauf-Position 1--0084-0000009'),(2680,175,34.99,'2025-01-03','direct_debit',1,3,1210715821,'Zahllauf-Position 1--0087-0000009'),(2681,175,34.99,'2025-02-04','direct_debit',1,3,1210739187,'Zahllauf-Position 1--0088-0000010'),(2682,175,34.99,'2025-03-04','direct_debit',1,3,1210760605,'Zahllauf-Position 1--0089-0000009'),(2683,175,34.99,'2025-04-03','direct_debit',1,3,1210791715,'Zahllauf-Position 1--0091-0000009'),(2684,175,34.99,'2025-05-05','direct_debit',1,3,1210819350,'Zahllauf-Position 1--0092-0000009'),(2685,175,34.99,'2025-06-03','direct_debit',1,3,1210844947,'Zahllauf-Position 1--0093-0000009'),(2686,175,34.99,'2025-07-03','direct_debit',1,3,1210868916,'Zahllauf-Position 1--0094-0000009'),(2687,175,34.99,'2025-08-05','direct_debit',1,3,1210894097,'Zahllauf-Position 1--0095-0000008'),(2688,175,34.99,'2025-09-03','direct_debit',1,3,1210924622,'Zahllauf-Position 1--0096-0000008'),(2689,175,34.99,'2025-10-03','direct_debit',1,3,1210956327,'Zahllauf-Position 1--0097-0000007'),(2690,175,34.99,'2025-11-04','direct_debit',1,3,1210995917,'Zahllauf-Position 1--0098-0000007'),(2691,175,34.99,'2025-12-03','direct_debit',1,3,1211031514,'Zahllauf-Position 1--0099-0000006'),(2711,177,102.98,'2023-11-24','direct_debit',1,3,1210407740,'Zahllauf-Position 1--0064-0000002'),(2712,177,102.98,'2023-11-24','direct_debit',1,3,1210407740,'Zahllauf-Position 1--0064-0000002'),(2713,177,102.98,'2023-11-24','direct_debit',1,3,1210407740,'Zahllauf-Position 1--0064-0000002'),(2714,177,34.99,'2023-11-30','direct_debit',1,3,1210412495,'Zahllauf-Position 1--0065-0000050'),(2715,177,34.99,'2024-01-05','direct_debit',1,3,1210446064,'Zahllauf-Position 1--0073-0000028'),(2716,177,34.99,'2024-02-05','direct_debit',1,3,1210468368,'Zahllauf-Position 1--0074-0000029'),(2717,177,34.99,'2024-03-05','direct_debit',1,3,1210495801,'Zahllauf-Position 1--0075-0000029'),(2718,177,34.99,'2024-04-03','direct_debit',1,3,1210519978,'Zahllauf-Position 1--0076-0000028'),(2719,177,34.99,'2024-05-03','direct_debit',1,3,1210543321,'Zahllauf-Position 1--0077-0000029'),(2756,179,78.48,'2023-12-05','direct_debit',1,3,1210419601,'Zahllauf-Position 1--0067-0000002'),(2757,179,78.48,'2023-12-05','direct_debit',1,3,1210419601,'Zahllauf-Position 1--0067-0000002'),(2758,179,78.48,'2023-12-05','direct_debit',1,3,1210419601,'Zahllauf-Position 1--0067-0000002'),(2759,179,34.99,'2024-01-05','direct_debit',1,3,1210445865,'Zahllauf-Position 1--0073-0000003'),(2760,179,34.99,'2024-02-05','direct_debit',1,3,1210468243,'Zahllauf-Position 1--0074-0000003'),(2761,179,34.99,'2024-03-05','direct_debit',1,3,1210495977,'Zahllauf-Position 1--0075-0000003'),(2762,179,34.99,'2024-04-03','direct_debit',1,3,1210519169,'Zahllauf-Position 1--0076-0000003'),(2763,179,34.99,'2024-05-03','direct_debit',1,3,1210543262,'Zahllauf-Position 1--0077-0000004'),(2764,179,34.99,'2024-06-04','direct_debit',1,3,1210563103,'Zahllauf-Position 1--0078-0000004'),(2765,179,34.99,'2024-07-03','direct_debit',1,3,1210585930,'Zahllauf-Position 1--0079-0000030'),(2766,179,34.99,'2024-08-05','direct_debit',1,3,1210612046,'Zahllauf-Position 1--0080-0000027'),(2767,179,34.99,'2024-09-03','direct_debit',1,3,1210633081,'Zahllauf-Position 1--0081-0000025'),(2768,179,34.99,'2024-10-03','direct_debit',1,3,1210653163,'Zahllauf-Position 1--0082-0000025'),(2769,179,34.99,'2024-11-05','direct_debit',1,3,1210671981,'Zahllauf-Position 1--0083-0000025'),(2770,179,34.99,'2024-12-03','direct_debit',1,3,1210695328,'Zahllauf-Position 1--0084-0000024'),(2771,179,34.99,'2025-02-04','direct_debit',1,3,1210739441,'Zahllauf-Position 1--0088-0000025'),(2772,179,34.99,'2025-03-04','direct_debit',1,3,1210760606,'Zahllauf-Position 1--0089-0000024'),(2773,179,34.99,'2025-04-03','direct_debit',1,3,1210791866,'Zahllauf-Position 1--0091-0000024'),(2774,179,34.99,'2025-05-05','direct_debit',1,3,1210819357,'Zahllauf-Position 1--0092-0000023'),(2775,179,34.99,'2025-06-03','direct_debit',1,3,1210844877,'Zahllauf-Position 1--0093-0000023'),(2776,179,34.99,'2025-07-03','direct_debit',1,3,1210868309,'Zahllauf-Position 1--0094-0000023'),(2777,179,34.99,'2025-08-05','direct_debit',1,3,1210893960,'Zahllauf-Position 1--0095-0000020'),(2778,179,34.99,'2025-09-03','direct_debit',1,3,1210924628,'Zahllauf-Position 1--0096-0000019'),(2779,179,34.99,'2025-10-03','direct_debit',1,3,1210956273,'Zahllauf-Position 1--0097-0000017'),(2780,179,34.99,'2025-11-04','direct_debit',1,3,1210995864,'Zahllauf-Position 1--0098-0000016'),(2781,179,34.99,'2025-12-03','direct_debit',1,3,1211031512,'Zahllauf-Position 1--0099-0000016'),(2905,185,102.73,'2024-03-05','direct_debit',1,3,1210495800,'Zahllauf-Position 1--0075-0000018'),(2906,185,102.73,'2024-03-05','direct_debit',1,3,1210495800,'Zahllauf-Position 1--0075-0000018'),(2907,185,102.73,'2024-03-05','direct_debit',1,3,1210495800,'Zahllauf-Position 1--0075-0000018'),(2908,185,34.99,'2024-04-03','direct_debit',1,3,1210519772,'Zahllauf-Position 1--0076-0000018'),(2909,185,34.99,'2024-05-03','direct_debit',1,3,1210543424,'Zahllauf-Position 1--0077-0000019'),(2910,185,34.99,'2024-06-04','direct_debit',1,3,1210563109,'Zahllauf-Position 1--0078-0000019'),(2911,185,34.99,'2024-07-03','direct_debit',1,3,1210585783,'Zahllauf-Position 1--0079-0000028'),(2912,185,34.99,'2024-08-05','direct_debit',1,3,1210611932,'Zahllauf-Position 1--0080-0000025'),(2913,185,34.99,'2024-09-03','direct_debit',1,3,1210632934,'Zahllauf-Position 1--0081-0000023'),(2914,185,34.99,'2024-10-03','direct_debit',1,3,1210653219,'Zahllauf-Position 1--0082-0000023'),(2915,185,34.99,'2024-11-05','direct_debit',1,3,1210671887,'Zahllauf-Position 1--0083-0000023'),(2916,185,34.99,'2024-12-03','direct_debit',1,3,1210695521,'Zahllauf-Position 1--0084-0000022'),(2917,185,34.99,'2025-01-03','direct_debit',1,3,1210715825,'Zahllauf-Position 1--0087-0000022'),(2918,185,34.99,'2025-02-04','direct_debit',1,3,1210739241,'Zahllauf-Position 1--0088-0000023'),(2919,185,34.99,'2025-03-04','direct_debit',1,3,1210760664,'Zahllauf-Position 1--0089-0000022'),(2920,185,34.99,'2025-04-03','direct_debit',1,3,1210791767,'Zahllauf-Position 1--0091-0000022'),(2921,185,34.99,'2025-05-05','direct_debit',1,3,1210819584,'Zahllauf-Position 1--0092-0000021'),(2922,185,34.99,'2025-06-03','direct_debit',1,3,1210844940,'Zahllauf-Position 1--0093-0000022'),(2923,185,34.99,'2025-07-03','direct_debit',1,3,1210869011,'Zahllauf-Position 1--0094-0000022'),(2924,185,34.99,'2025-08-05','direct_debit',1,3,1210894093,'Zahllauf-Position 1--0095-0000019'),(2925,185,34.99,'2025-09-03','direct_debit',1,3,1210924698,'Zahllauf-Position 1--0096-0000017'),(2926,185,34.99,'2025-10-03','direct_debit',1,3,1210956375,'Zahllauf-Position 1--0097-0000015'),(2927,185,34.99,'2025-11-04','direct_debit',1,3,1210995998,'Zahllauf-Position 1--0098-0000015'),(2928,185,34.99,'2025-12-03','direct_debit',1,3,1211031702,'Zahllauf-Position 1--0099-0000015'),(3112,189,82.99,'2022-04-05','direct_debit',1,3,1210038809,'Zahllauf-Position 1--0001-0000007'),(3113,189,49.99,'2022-04-12','direct_debit',1,3,1210042305,'Zahllauf-Position 1--0012-0000007'),(3114,189,49.99,'2022-05-24','direct_debit',1,3,1210054819,'Zahllauf-Position 1--0016-0000006'),(3115,189,49.99,'2022-06-30','direct_debit',1,3,1210070397,'Zahllauf-Position 1--0018-0000006'),(3116,189,49.99,'2022-08-02','direct_debit',1,3,1210084452,'Zahllauf-Position 1--0023-0000006'),(3117,189,49.99,'2022-08-31','direct_debit',1,3,1210099287,'Zahllauf-Position 1--0026-0000006'),(3118,189,49.99,'2022-09-21','direct_debit',1,3,1210111673,'Zahllauf-Position 1--0027-0000006'),(3119,189,49.99,'2022-10-04','direct_debit',1,3,1210122449,'Zahllauf-Position 1--0033-0000006'),(3120,189,49.99,'2022-11-02','direct_debit',1,3,1210144859,'Zahllauf-Position 1--0036-0000006'),(3121,189,49.99,'2022-12-01','direct_debit',1,3,1210165181,'Zahllauf-Position 1--0040-0000006'),(3122,189,49.99,'2023-01-03','direct_debit',1,3,1210185894,'Zahllauf-Position 1--0041-0000007'),(3123,189,49.99,'2023-02-01','direct_debit',1,3,1210203076,'Zahllauf-Position 1--0043-0000007'),(3124,189,49.99,'2023-03-03','direct_debit',1,3,1210220983,'Zahllauf-Position 1--0044-0000007'),(3125,189,49.99,'2023-04-01','direct_debit',1,3,1210244129,'Zahllauf-Position 1--0050-0000007'),(3126,189,49.99,'2023-05-02','direct_debit',1,3,1210264225,'Zahllauf-Position 1--0052-0000007'),(3127,189,49.99,'2023-06-01','direct_debit',1,3,1210282579,'Zahllauf-Position 1--0054-0000007'),(3128,189,49.99,'2023-07-03','direct_debit',1,3,1210302070,'Zahllauf-Position 1--0055-0000007'),(3129,189,49.99,'2023-08-02','direct_debit',1,3,1210326836,'Zahllauf-Position 1--0057-0000007'),(3130,189,49.99,'2023-09-01','direct_debit',1,3,1210345930,'Zahllauf-Position 1--0059-0000007'),(3131,189,49.99,'2023-10-05','direct_debit',1,3,1210366660,'Zahllauf-Position 1--0060-0000006'),(3132,189,49.99,'2023-11-06','direct_debit',1,3,1210390481,'Zahllauf-Position 1--0062-0000006'),(3133,189,49.99,'2023-11-30','direct_debit',1,3,1210412591,'Zahllauf-Position 1--0065-0000006'),(3134,189,49.99,'2024-01-05','direct_debit',1,3,1210446013,'Zahllauf-Position 1--0073-0000040'),(3135,189,49.99,'2024-02-05','direct_debit',1,3,1210468316,'Zahllauf-Position 1--0074-0000042'),(3136,189,49.99,'2024-03-05','direct_debit',1,3,1210495920,'Zahllauf-Position 1--0075-0000044'),(3137,189,49.99,'2024-04-03','direct_debit',1,3,1210519825,'Zahllauf-Position 1--0076-0000043'),(3138,189,49.99,'2024-05-03','direct_debit',1,3,1210543428,'Zahllauf-Position 1--0077-0000043'),(3139,189,49.99,'2024-06-04','direct_debit',1,3,1210563153,'Zahllauf-Position 1--0078-0000042'),(3140,189,49.99,'2024-07-03','direct_debit',1,3,1210585780,'Zahllauf-Position 1--0079-0000007'),(3141,189,49.99,'2024-08-05','direct_debit',1,3,1210611880,'Zahllauf-Position 1--0080-0000008'),(3142,189,49.99,'2024-09-03','direct_debit',1,3,1210632931,'Zahllauf-Position 1--0081-0000007'),(3143,189,49.99,'2024-10-03','direct_debit',1,3,1210653312,'Zahllauf-Position 1--0082-0000007'),(3144,189,49.99,'2024-11-05','direct_debit',1,3,1210671882,'Zahllauf-Position 1--0083-0000007'),(3145,189,49.99,'2024-12-03','direct_debit',1,3,1210695321,'Zahllauf-Position 1--0084-0000006'),(3146,189,49.99,'2025-01-03','direct_debit',1,3,1210715928,'Zahllauf-Position 1--0087-0000006'),(3147,189,49.99,'2025-02-04','direct_debit',1,3,1210739340,'Zahllauf-Position 1--0088-0000007'),(3148,189,49.99,'2025-03-04','direct_debit',1,3,1210760608,'Zahllauf-Position 1--0089-0000006'),(3149,189,49.99,'2025-04-03','direct_debit',1,3,1210791711,'Zahllauf-Position 1--0091-0000006'),(3150,189,49.99,'2025-05-05','direct_debit',1,3,1210819351,'Zahllauf-Position 1--0092-0000003'),(3151,189,49.99,'2025-06-03','direct_debit',1,3,1210845041,'Zahllauf-Position 1--0093-0000001'),(3152,189,49.99,'2025-07-03','direct_debit',1,3,1210868304,'Zahllauf-Position 1--0094-0000006'),(3153,189,49.99,'2025-08-05','direct_debit',1,3,1210893398,'Zahllauf-Position 1--0095-0000001'),(3154,189,49.99,'2025-09-03','direct_debit',1,3,1210924801,'Zahllauf-Position 1--0096-0000006'),(3155,189,82.99,'2022-04-05','direct_debit',1,3,1210038809,'Zahllauf-Position 1--0001-0000007'),(3156,189,49.99,'2024-10-03','direct_debit',1,3,1210653312,'Zahllauf-Position 1--0082-0000007'),(3157,189,49.99,'2024-11-05','direct_debit',1,3,1210671882,'Zahllauf-Position 1--0083-0000007'),(3158,189,49.99,'2024-12-03','direct_debit',1,3,1210695321,'Zahllauf-Position 1--0084-0000006'),(3159,189,49.99,'2025-01-03','direct_debit',1,3,1210715928,'Zahllauf-Position 1--0087-0000006'),(3160,189,49.99,'2025-02-04','direct_debit',1,3,1210739340,'Zahllauf-Position 1--0088-0000007'),(3161,189,49.99,'2025-03-04','direct_debit',1,3,1210760608,'Zahllauf-Position 1--0089-0000006'),(3162,189,49.99,'2025-04-03','direct_debit',1,3,1210791711,'Zahllauf-Position 1--0091-0000006'),(3163,189,49.99,'2025-05-05','direct_debit',1,3,1210819351,'Zahllauf-Position 1--0092-0000003'),(3164,189,49.99,'2025-06-03','direct_debit',1,3,1210845041,'Zahllauf-Position 1--0093-0000001'),(3165,189,49.99,'2025-07-03','direct_debit',1,3,1210868304,'Zahllauf-Position 1--0094-0000006'),(3166,189,49.99,'2025-08-05','direct_debit',1,3,1210893398,'Zahllauf-Position 1--0095-0000001'),(3167,189,49.99,'2025-09-03','direct_debit',1,3,1210924801,'Zahllauf-Position 1--0096-0000006');
/*!40000 ALTER TABLE `beitraege` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `benachrichtigungen`
--

DROP TABLE IF EXISTS `benachrichtigungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `benachrichtigungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL COMMENT 'EmpfÃ¤nger der Benachrichtigung (Admin/Trainer)',
  `nachricht` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `typ` enum('info','warnung','barzahlung','wichtig') COLLATE utf8mb4_unicode_ci DEFAULT 'info',
  `gelesen` tinyint(1) DEFAULT '0',
  `erstellt_am` datetime NOT NULL,
  `gelesen_am` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mitglied_gelesen` (`mitglied_id`,`gelesen`),
  KEY `idx_erstellt` (`erstellt_am`),
  CONSTRAINT `benachrichtigungen_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `benachrichtigungen`
--

LOCK TABLES `benachrichtigungen` WRITE;
/*!40000 ALTER TABLE `benachrichtigungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `benachrichtigungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `break_even_berechnungen`
--

DROP TABLE IF EXISTS `break_even_berechnungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `break_even_berechnungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fixkosten` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `variable_kosten` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `durchschnittsbeitrag` decimal(10,2) NOT NULL,
  `break_even_mitglieder` int NOT NULL,
  `break_even_umsatz` decimal(10,2) NOT NULL,
  `sicherheitspuffer_prozent` decimal(5,2) NOT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `break_even_berechnungen_chk_1` CHECK (json_valid(`fixkosten`)),
  CONSTRAINT `break_even_berechnungen_chk_2` CHECK (json_valid(`variable_kosten`))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `break_even_berechnungen`
--

LOCK TABLES `break_even_berechnungen` WRITE;
/*!40000 ALTER TABLE `break_even_berechnungen` DISABLE KEYS */;
INSERT INTO `break_even_berechnungen` VALUES (1,'{\"miete\": 3280, \"strom\": 80, \"wasser\": 40, \"telefon\": 0, \"wartung\": 0, \"internet\": 40, \"software\": 0, \"reinigung\": 0, \"versicherung\": 10}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,47,3478.00,20.00,'2025-10-09 08:12:39'),(2,'{\"miete\": 3280, \"strom\": 80, \"wasser\": 80, \"telefon\": 0, \"wartung\": 0, \"internet\": 40, \"software\": 0, \"reinigung\": 0, \"versicherung\": 10}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-09 08:14:58'),(3,'{\"miete\": 3280, \"strom\": 80, \"wasser\": 80, \"telefon\": 0, \"wartung\": 0, \"internet\": 40, \"software\": 0, \"reinigung\": 0, \"versicherung\": 10}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-09 08:16:22'),(4,'{\"miete\": 3280, \"strom\": 0, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 0}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,45,3330.00,20.00,'2025-10-09 08:16:34'),(5,'{\"miete\": 3277, \"strom\": 0, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 0}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,45,3330.00,20.00,'2025-10-09 08:18:52'),(6,'{\"miete\": 3280, \"strom\": 0, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 0}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,45,3330.00,20.00,'2025-10-09 08:20:37'),(7,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-25 04:48:51'),(8,'{\"miete\": 2500, \"strom\": 120, \"versicherung\": 180}','{\"marketing\": 200, \"ausruestung\": 300}',85.00,39,3315.00,20.00,'2025-10-25 04:54:07'),(9,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-25 04:54:54'),(10,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,49,3626.00,20.00,'2025-10-25 04:57:35'),(11,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,49,3626.00,20.00,'2025-10-26 05:53:36'),(12,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',64.00,57,3648.00,20.00,'2025-10-26 05:53:45'),(13,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',64.00,57,3648.00,20.00,'2025-10-26 05:53:46'),(14,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,49,3626.00,20.00,'2025-10-26 05:54:29'),(15,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',64.00,57,3648.00,20.00,'2025-11-06 12:26:36'),(16,'{\"0\":\"{\",\"1\":\"\\\"\",\"2\":\"m\",\"3\":\"i\",\"4\":\"e\",\"5\":\"t\",\"6\":\"e\",\"7\":\"\\\"\",\"8\":\":\",\"9\":\" \",\"10\":\"3\",\"11\":\"2\",\"12\":\"8\",\"13\":\"0\",\"14\":\",\",\"15\":\" \",\"16\":\"\\\"\",\"17\":\"s\",\"18\":\"t\",\"19\":\"r\",\"20\":\"o\",\"21\":\"m\",\"22\":\"\\\"\",\"23\":\":\",\"24\":\" \",\"25\":\"1\",\"26\":\"0\",\"27\":\"0\",\"28\":\",\",\"29\":\" \",\"30\":\"\\\"\",\"31\":\"w\",\"32\":\"a\",\"33\":\"s\",\"34\":\"s\",\"35\":\"e\",\"36\":\"r\",\"37\":\"\\\"\",\"38\":\":\",\"39\":\" \",\"40\":\"1\",\"41\":\"0\",\"42\":\"0\",\"43\":\",\",\"44\":\" \",\"45\":\"\\\"\",\"46\":\"t\",\"47\":\"e\",\"48\":\"l\",\"49\":\"e\",\"50\":\"f\",\"51\":\"o\",\"52\":\"n\",\"53\":\"\\\"\",\"54\":\":\",\"55\":\" \",\"56\":\"0\",\"57\":\",\",\"58\":\" \",\"59\":\"\\\"\",\"60\":\"w\",\"61\":\"a\",\"62\":\"r\",\"63\":\"t\",\"64\":\"u\",\"65\":\"n\",\"66\":\"g\",\"67\":\"\\\"\",\"68\":\":\",\"69\":\" \",\"70\":\"0\",\"71\":\",\",\"72\":\" \",\"73\":\"\\\"\",\"74\":\"i\",\"75\":\"n\",\"76\":\"t\",\"77\":\"e\",\"78\":\"r\",\"79\":\"n\",\"80\":\"e\",\"81\":\"t\",\"82\":\"\\\"\",\"83\":\":\",\"84\":\" \",\"85\":\"0\",\"86\":\",\",\"87\":\" \",\"88\":\"\\\"\",\"89\":\"s\",\"90\":\"o\",\"91\":\"f\",\"92\":\"t\",\"93\":\"w\",\"94\":\"a\",\"95\":\"r\",\"96\":\"e\",\"97\":\"\\\"\",\"98\":\":\",\"99\":\" \",\"100\":\"0\",\"101\":\",\",\"102\":\" \",\"103\":\"\\\"\",\"104\":\"r\",\"105\":\"e\",\"106\":\"i\",\"107\":\"n\",\"108\":\"i\",\"109\":\"g\",\"110\":\"u\",\"111\":\"n\",\"112\":\"g\",\"113\":\"\\\"\",\"114\":\":\",\"115\":\" \",\"116\":\"0\",\"117\":\",\",\"118\":\" \",\"119\":\"\\\"\",\"120\":\"v\",\"121\":\"e\",\"122\":\"r\",\"123\":\"s\",\"124\":\"i\",\"125\":\"c\",\"126\":\"h\",\"127\":\"e\",\"128\":\"r\",\"129\":\"u\",\"130\":\"n\",\"131\":\"g\",\"132\":\"\\\"\",\"133\":\":\",\"134\":\" \",\"135\":\"1\",\"136\":\"2\",\"137\":\"0\",\"138\":\"}\",\"miete\":4200,\"versicherung\":163}','\"{\\\"events\\\": 0, \\\"material\\\": 0, \\\"marketing\\\": 0, \\\"ausruestung\\\": 0, \\\"fortbildungen\\\": 0}\"',64.00,69,4416.00,20.00,'2025-12-07 21:37:59');
/*!40000 ALTER TABLE `break_even_berechnungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `buddy_aktivitaeten`
--

DROP TABLE IF EXISTS `buddy_aktivitaeten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `buddy_aktivitaeten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `buddy_gruppe_id` int NOT NULL,
  `buddy_einladung_id` int DEFAULT NULL,
  `aktivitaet_typ` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `benutzer_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_buddy_aktivitaeten_gruppe` (`buddy_gruppe_id`),
  KEY `idx_buddy_aktivitaeten_einladung` (`buddy_einladung_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `buddy_aktivitaeten`
--

LOCK TABLES `buddy_aktivitaeten` WRITE;
/*!40000 ALTER TABLE `buddy_aktivitaeten` DISABLE KEYS */;
/*!40000 ALTER TABLE `buddy_aktivitaeten` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `buddy_einladungen`
--

DROP TABLE IF EXISTS `buddy_einladungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `buddy_einladungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `buddy_gruppe_id` int NOT NULL,
  `freund_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `freund_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `einladungs_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_gueltig_bis` datetime NOT NULL,
  `status` enum('eingeladen','email_gesendet','registriert','aktiviert','abgelehnt','abgelaufen') COLLATE utf8mb4_unicode_ci DEFAULT 'eingeladen',
  `registrierung_id` int DEFAULT NULL,
  `mitglied_id` int DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `einladung_gesendet_am` datetime DEFAULT NULL,
  `registriert_am` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `einladungs_token` (`einladungs_token`),
  KEY `idx_buddy_einladungen_gruppe` (`buddy_gruppe_id`),
  KEY `idx_buddy_einladungen_token` (`einladungs_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `buddy_einladungen`
--

LOCK TABLES `buddy_einladungen` WRITE;
/*!40000 ALTER TABLE `buddy_einladungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `buddy_einladungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `buddy_email_log`
--

DROP TABLE IF EXISTS `buddy_email_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `buddy_email_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `buddy_einladung_id` int NOT NULL,
  `email_typ` enum('einladung','erinnerung') COLLATE utf8mb4_unicode_ci NOT NULL,
  `empfaenger_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `betreff` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('gesendet','fehler') COLLATE utf8mb4_unicode_ci NOT NULL,
  `gesendet_am` datetime DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fehler_nachricht` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_buddy_email_log_einladung` (`buddy_einladung_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `buddy_email_log`
--

LOCK TABLES `buddy_email_log` WRITE;
/*!40000 ALTER TABLE `buddy_email_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `buddy_email_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `buddy_gruppen`
--

DROP TABLE IF EXISTS `buddy_gruppen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `buddy_gruppen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gruppe_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_mitglieder` int DEFAULT '0',
  `aktuelle_mitglieder` int DEFAULT '0',
  `ersteller_registrierung_id` int DEFAULT NULL,
  `status` enum('aktiv','archiviert','geloescht') COLLATE utf8mb4_unicode_ci DEFAULT 'aktiv',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `buddy_gruppen`
--

LOCK TABLES `buddy_gruppen` WRITE;
/*!40000 ALTER TABLE `buddy_gruppen` DISABLE KEYS */;
/*!40000 ALTER TABLE `buddy_gruppen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `checkins`
--

DROP TABLE IF EXISTS `checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checkins` (
  `checkin_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `stundenplan_id` int NOT NULL,
  `checkin_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checkout_time` datetime DEFAULT NULL,
  `auto_checkout` tinyint(1) DEFAULT '0',
  `checkin_method` enum('touch','qr_code','manual','nfc','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'touch',
  `qr_code_used` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','completed','cancelled','no_show') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `bemerkung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`checkin_id`),
  UNIQUE KEY `unique_member_stundenplan_date` (`mitglied_id`,`stundenplan_id`,`checkin_time`),
  KEY `idx_member_checkin` (`mitglied_id`,`checkin_time`),
  KEY `idx_stundenplan_checkin` (`stundenplan_id`,`checkin_time`),
  KEY `idx_checkin_time` (`checkin_time`),
  KEY `idx_status` (`status`),
  KEY `idx_method` (`checkin_method`),
  KEY `idx_member_status` (`mitglied_id`,`status`,`checkin_time`),
  KEY `idx_active_checkins` (`status`,`checkin_time`),
  KEY `idx_daily_stundenplan` (`stundenplan_id`,`checkin_time`,`status`),
  CONSTRAINT `checkins_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `checkins_ibfk_2` FOREIGN KEY (`stundenplan_id`) REFERENCES `stundenplan` (`stundenplan_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `checkins_chk_1` CHECK (json_valid(`device_info`)),
  CONSTRAINT `chk_checkout_after_checkin` CHECK (((`checkout_time` is null) or (`checkout_time` >= `checkin_time`)))
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checkins`
--

LOCK TABLES `checkins` WRITE;
/*!40000 ALTER TABLE `checkins` DISABLE KEYS */;
INSERT INTO `checkins` VALUES (1,68,19,'2025-12-08 17:04:26',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 16:04:26','2025-12-08 16:04:26'),(2,185,19,'2025-12-08 21:45:18',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:18','2025-12-08 20:45:18'),(3,164,19,'2025-12-08 21:45:19',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:19','2025-12-08 20:45:19'),(4,109,19,'2025-12-08 21:45:21',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:21','2025-12-08 20:45:21'),(5,99,19,'2025-12-08 21:45:22',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:22','2025-12-08 20:45:22'),(6,74,19,'2025-12-08 21:45:27',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:27','2025-12-08 20:45:27'),(7,78,19,'2025-12-08 21:45:28',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:28','2025-12-08 20:45:28'),(8,164,20,'2025-12-08 21:45:46',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:46','2025-12-08 20:45:46'),(9,109,20,'2025-12-08 21:45:48',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:48','2025-12-08 20:45:48'),(10,99,20,'2025-12-08 21:45:50',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:50','2025-12-08 20:45:50'),(11,112,20,'2025-12-08 21:45:51',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:51','2025-12-08 20:45:51'),(12,74,20,'2025-12-08 21:45:57',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:57','2025-12-08 20:45:57'),(13,118,20,'2025-12-08 21:45:57',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:57','2025-12-08 20:45:57'),(14,169,20,'2025-12-08 21:45:58',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:45:58','2025-12-08 20:45:58'),(15,120,20,'2025-12-08 21:46:00',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2025-12-08 20:46:00','2025-12-08 20:46:00'),(16,68,23,'2025-12-09 17:31:50','2025-12-09 17:35:28',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:31:50','2025-12-09 16:35:28'),(17,78,23,'2025-12-09 17:31:51','2025-12-09 17:35:22',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:31:51','2025-12-09 16:35:22'),(18,164,24,'2025-12-09 17:32:17','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:32:17','2025-12-09 20:32:25'),(19,68,24,'2025-12-09 17:32:27','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:32:27','2025-12-09 20:32:25'),(20,90,25,'2025-12-09 17:32:45','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:32:45','2025-12-09 20:32:25'),(21,89,25,'2025-12-09 17:32:52','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:32:52','2025-12-09 20:32:25'),(22,179,25,'2025-12-09 17:32:59','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:32:59','2025-12-09 20:32:25'),(23,164,25,'2025-12-09 17:33:06','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:33:06','2025-12-09 20:32:25'),(24,112,26,'2025-12-09 17:42:31','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:42:31','2025-12-09 20:32:25'),(25,118,26,'2025-12-09 17:42:37','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 16:42:37','2025-12-09 20:32:25'),(26,80,27,'2025-12-09 19:48:49','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 18:48:49','2025-12-09 20:32:25'),(27,79,27,'2025-12-09 19:48:55','2025-12-09 21:32:25',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-09 18:48:55','2025-12-09 20:32:25'),(28,185,22,'2025-12-18 16:28:24','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:24','2025-12-18 22:07:48'),(29,83,22,'2025-12-18 16:28:26','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:26','2025-12-18 22:07:48'),(30,109,22,'2025-12-18 16:28:28','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:28','2025-12-18 22:07:48'),(31,68,22,'2025-12-18 16:28:34','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:34','2025-12-18 22:07:48'),(32,84,22,'2025-12-18 16:28:36','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:36','2025-12-18 22:07:48'),(33,116,22,'2025-12-18 16:28:41','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:41','2025-12-18 22:07:48'),(34,78,22,'2025-12-18 16:28:42','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:42','2025-12-18 22:07:48'),(35,80,29,'2025-12-18 16:28:46','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:46','2025-12-18 22:07:48'),(36,81,29,'2025-12-18 16:28:47','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:47','2025-12-18 22:07:48'),(37,174,30,'2025-12-18 16:28:54','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:54','2025-12-18 22:07:48'),(38,148,30,'2025-12-18 16:28:55','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:55','2025-12-18 22:07:48'),(39,80,30,'2025-12-18 16:28:58','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:58','2025-12-18 22:07:48'),(40,81,30,'2025-12-18 16:28:59','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:28:59','2025-12-18 22:07:48'),(41,140,30,'2025-12-18 16:29:02','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:29:02','2025-12-18 22:07:48'),(42,68,23,'2025-12-18 16:29:17','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:29:17','2025-12-18 22:07:48'),(43,78,23,'2025-12-18 16:29:18','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:29:18','2025-12-18 22:07:48'),(44,170,22,'2025-12-18 16:29:28','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:29:28','2025-12-18 22:07:48'),(45,179,24,'2025-12-18 16:29:54','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:29:54','2025-12-18 22:07:48'),(46,89,24,'2025-12-18 16:30:02','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:30:02','2025-12-18 22:07:48'),(47,89,25,'2025-12-18 16:30:09','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:30:09','2025-12-18 22:07:48'),(48,179,25,'2025-12-18 16:30:11','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:30:11','2025-12-18 22:07:48'),(49,90,25,'2025-12-18 16:30:19','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:30:19','2025-12-18 22:07:48'),(50,112,26,'2025-12-18 16:30:40','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:30:40','2025-12-18 22:07:48'),(51,118,26,'2025-12-18 16:30:58','2025-12-18 23:07:48',0,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2025-12-18 15:30:58','2025-12-18 22:07:48'),(52,68,22,'2026-01-07 17:02:35','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 16:02:35','2026-01-08 23:01:00'),(53,109,22,'2026-01-07 17:03:07','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 16:03:07','2026-01-08 23:01:00'),(54,84,22,'2026-01-07 17:07:34','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 16:07:34','2026-01-08 23:01:00'),(55,87,22,'2026-01-07 17:08:15','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 16:08:15','2026-01-08 23:01:00'),(56,170,22,'2026-01-07 17:08:31','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 16:08:31','2026-01-08 23:01:00'),(57,78,22,'2026-01-07 17:14:58','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 16:14:58','2026-01-08 23:01:00'),(58,153,29,'2026-01-07 18:17:14','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 17:17:14','2026-01-08 23:01:00'),(59,81,29,'2026-01-07 18:17:48','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 17:17:48','2026-01-08 23:01:00'),(60,81,30,'2026-01-07 19:20:32','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 18:20:32','2026-01-08 23:01:00'),(61,134,30,'2026-01-07 19:20:48','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 18:20:48','2026-01-08 23:01:00'),(62,153,30,'2026-01-07 19:21:00','2026-01-07 23:59:59',1,'manual',NULL,NULL,NULL,NULL,'completed',NULL,NULL,'2026-01-07 18:21:00','2026-01-08 23:01:00'),(63,174,30,'2026-01-08 13:32:59',NULL,0,'manual',NULL,NULL,NULL,NULL,'active',NULL,NULL,'2026-01-08 12:32:59','2026-01-08 12:32:59');
/*!40000 ALTER TABLE `checkins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `datev_exports`
--

DROP TABLE IF EXISTS `datev_exports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `datev_exports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payment_intent_id` int NOT NULL,
  `export_type` enum('booking','customer','invoice') COLLATE utf8mb4_unicode_ci DEFAULT 'booking',
  `datev_booking_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'DATEV Buchungs-ID',
  `datev_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Vollst├ñndige DATEV API Response',
  `export_status` enum('pending','processing','success','failed','retry') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `retry_count` int DEFAULT '0',
  `account_from` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Soll-Konto (z.B. 1200 Debitor)',
  `account_to` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Haben-Konto (z.B. 1000 Bank)',
  `booking_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Buchungstext',
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payment_intent_id` (`payment_intent_id`),
  KEY `idx_export_status` (`export_status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_retry` (`export_status`,`retry_count`),
  CONSTRAINT `datev_exports_ibfk_1` FOREIGN KEY (`payment_intent_id`) REFERENCES `stripe_payment_intents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `datev_exports_chk_1` CHECK (json_valid(`datev_response`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DATEV Export Log f├╝r automatische Buchf├╝hrung';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `datev_exports`
--

LOCK TABLES `datev_exports` WRITE;
/*!40000 ALTER TABLE `datev_exports` DISABLE KEYS */;
/*!40000 ALTER TABLE `datev_exports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dojo`
--

DROP TABLE IF EXISTS `dojo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dojo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojoname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subdomain` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inhaber` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hausnummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobil` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `internet` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `untertitel` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'z.B. "Traditionelles Karate seit 1985"',
  `vertreter` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stellvertreter/2. Vorsitzender',
  `gruendungsjahr` int DEFAULT NULL,
  `mitgliederzahl_aktuell` int DEFAULT '0',
  `land` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Deutschland',
  `fax` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'info@dojo.de',
  `email_anmeldung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'anmeldung@dojo.de',
  `steuernummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `umsatzsteuer_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'USt-IdNr.',
  `finanzamt` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `steuerberater` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `steuerberater_telefon` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `umsatzsteuerpflichtig` tinyint(1) DEFAULT '0',
  `kleinunternehmer` tinyint(1) DEFAULT '0' COMMENT '§19 UStG',
  `gemeinnuetzig` tinyint(1) DEFAULT '0',
  `freistellungsbescheid_datum` date DEFAULT NULL,
  `rechtsform` enum('Verein','GmbH','Einzelunternehmen','GbR','UG','AG') COLLATE utf8mb4_unicode_ci DEFAULT 'Verein',
  `vereinsregister_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amtsgericht` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `handelsregister_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geschaeftsfuehrer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vorstand_1_vorsitzender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vorstand_2_vorsitzender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vorstand_kassenwart` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vorstand_schriftfuehrer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_iban` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_bic` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_inhaber` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_verwendungszweck` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sepa_glaeubiger_id` varchar(35) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `iban` varchar(34) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bic` varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paypal_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastschrift_aktiv` tinyint(1) DEFAULT '0',
  `haftpflicht_versicherung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `haftpflicht_police_nr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `haftpflicht_ablauf` date DEFAULT NULL,
  `unfallversicherung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unfallversicherung_police_nr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gebaeudeversicherung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agb_text` text COLLATE utf8mb4_unicode_ci,
  `datenschutz_text` text COLLATE utf8mb4_unicode_ci,
  `widerrufsrecht_text` text COLLATE utf8mb4_unicode_ci,
  `impressum_text` text COLLATE utf8mb4_unicode_ci,
  `kuendigungsfrist_monate` int DEFAULT '3',
  `mindestlaufzeit_monate` int DEFAULT '12',
  `probezeit_tage` int DEFAULT '14',
  `oeffnungszeiten` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT '{"montag": {"von": "16:00", "bis": "22:00"}}',
  `feiertage_geschlossen` tinyint(1) DEFAULT '1',
  `ferien_geschlossen` tinyint(1) DEFAULT '0',
  `notfallkontakt_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt_telefon` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hausmeister_kontakt` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `facebook_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instagram_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `youtube_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `twitter_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_nummer` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `newsletter_aktiv` tinyint(1) DEFAULT '0',
  `google_maps_url` text COLLATE utf8mb4_unicode_ci,
  `kampfkunst_stil` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'z.B. "Shotokan Karate"',
  `verband` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'z.B. "DKV - Deutscher Karate Verband"',
  `verband_mitgliedsnummer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lizenz_trainer_a` int DEFAULT '0',
  `lizenz_trainer_b` int DEFAULT '0',
  `lizenz_trainer_c` int DEFAULT '0',
  `beitrag_erwachsene` decimal(10,2) DEFAULT NULL,
  `beitrag_kinder` decimal(10,2) DEFAULT NULL,
  `beitrag_familien` decimal(10,2) DEFAULT NULL,
  `aufnahmegebuehr` decimal(10,2) DEFAULT NULL,
  `kaution` decimal(10,2) DEFAULT NULL,
  `zahlungsarten` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT '["Lastschrift", "Überweisung", "Bar"]',
  `mahnung_gebuehr` decimal(10,2) DEFAULT '5.00',
  `rueckbuchung_gebuehr` decimal(10,2) DEFAULT '10.00',
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `favicon_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `theme_farbe` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#DAA520' COMMENT 'Dojo Gold',
  `sprache` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'de',
  `zeitzone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Europe/Berlin',
  `waehrung` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'EUR',
  `backup_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dsgvo_beauftragte` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_mitglieder` int DEFAULT '500',
  `max_trainer` int DEFAULT '20',
  `max_kurse` int DEFAULT '50',
  `auto_backup` tinyint(1) DEFAULT '1',
  `email_benachrichtigungen` tinyint(1) DEFAULT '1',
  `sms_benachrichtigungen` tinyint(1) DEFAULT '0',
  `auszeichnungen` text COLLATE utf8mb4_unicode_ci COMMENT 'Pokale, Erfolge, etc.',
  `gruender_meister` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `traditionslinie` text COLLATE utf8mb4_unicode_ci,
  `dojo_regeln` text COLLATE utf8mb4_unicode_ci,
  `pruefungsordnung` text COLLATE utf8mb4_unicode_ci,
  `graduierungssystem` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'z.B. "Kyu/Dan System"',
  `naechste_pruefung` date DEFAULT NULL,
  `naechstes_turnier` date DEFAULT NULL,
  `lehrgang_termine` text COLLATE utf8mb4_unicode_ci,
  `api_key_google` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_key_facebook` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_key_payment` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `webhook_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_backup` timestamp NULL DEFAULT NULL,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '1.0',
  `payment_provider` enum('manual_sepa','stripe_datev') COLLATE utf8mb4_unicode_ci DEFAULT 'manual_sepa' COMMENT 'Gew├ñhltes Zahlungssystem',
  `stripe_secret_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stripe Secret Key (verschl├╝sselt)',
  `stripe_publishable_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stripe Publishable Key',
  `datev_api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'DATEV API Key (verschl├╝sselt)',
  `datev_consultant_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'DATEV Beraternummer',
  `datev_client_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'DATEV Mandantennummer',
  `dsgvo_text` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Datenschutzerkl├ñrung gem├ñ├ƒ DSGVO',
  `dojo_regeln_text` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Dojo-Regeln und Verhaltenskodex',
  `hausordnung_text` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Hausordnung f├╝r die R├ñumlichkeiten',
  `widerrufsbelehrung_text` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Widerrufsbelehrung nach deutschem Recht',
  `vertragsbedingungen_text` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Spezifische Vertragsbedingungen f├╝r Mitgliedschaften',
  `steuer_status` enum('kleinunternehmer','regelbesteuerung') COLLATE utf8mb4_unicode_ci DEFAULT 'kleinunternehmer' COMMENT 'Steuerstatus des Dojos',
  `ust_satz` decimal(5,2) DEFAULT '0.00' COMMENT 'Umsatzsteuersatz in % (0 f├╝r Kleinunternehmer, 19 f├╝r Regelbesteuerung)',
  `kleinunternehmer_grenze` decimal(10,2) DEFAULT '22000.00' COMMENT 'Kleinunternehmer-Grenze in EUR (┬º19 UStG)',
  `jahresumsatz_aktuell` decimal(10,2) DEFAULT '0.00' COMMENT 'Aktueller Jahresumsatz',
  `jahresumsatz_vorjahr` decimal(10,2) DEFAULT '0.00' COMMENT 'Jahresumsatz des Vorjahres',
  `steuer_jahr` int DEFAULT '2025' COMMENT 'Steuerjahr f├╝r Umsatztracking',
  `steuer_warnung_80_prozent` tinyint(1) DEFAULT '0' COMMENT 'Warnung bei 80% der Grenze',
  `steuer_warnung_100_prozent` tinyint(1) DEFAULT '0' COMMENT 'Warnung bei ├£berschreitung',
  `ist_aktiv` tinyint(1) DEFAULT '1' COMMENT 'Dojo aktiv/inaktiv',
  `ist_hauptdojo` tinyint(1) DEFAULT '0' COMMENT 'Haupt-Dojo',
  `sortierung` int DEFAULT '0' COMMENT 'Sortierreihenfolge',
  `farbe` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#FFD700' COMMENT 'Dojo-Farbe (Hex)',
  `finanzamt_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Zust├ñndiges Finanzamt',
  `ust_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'USt-IdNr.',
  `aktualisiert_am` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `theme_scheme` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  `haftungsausschluss_text` text COLLATE utf8mb4_unicode_ci,
  `api_token_last_used` datetime DEFAULT NULL,
  `api_token_created_at` datetime DEFAULT NULL,
  `api_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `onboarding_completed` tinyint(1) DEFAULT '0',
  `registration_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `trial_ends_at` datetime DEFAULT NULL COMMENT '14 Tage nach created_at',
  `subscription_status` enum('trial','active','expired','cancelled','suspended') COLLATE utf8mb4_unicode_ci DEFAULT 'trial' COMMENT 'Status des Abonnements',
  `subscription_plan` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'basic' COMMENT 'Tarif: basic, premium, enterprise',
  `subscription_started_at` datetime DEFAULT NULL COMMENT 'Wann wurde bezahlt',
  `subscription_ends_at` datetime DEFAULT NULL COMMENT 'Abo-Ende (NULL = unbegrenzt)',
  `last_payment_at` datetime DEFAULT NULL COMMENT 'Letzte Zahlung',
  `payment_interval` enum('monthly','quarterly','yearly') COLLATE utf8mb4_unicode_ci DEFAULT 'monthly' COMMENT 'Zahlungsintervall',
  PRIMARY KEY (`id`),
  UNIQUE KEY `subdomain` (`subdomain`),
  KEY `idx_dojo_rechtsform` (`rechtsform`),
  KEY `idx_dojo_umsatzsteuer` (`umsatzsteuerpflichtig`),
  KEY `idx_dojo_updated` (`updated_at`),
  KEY `idx_dojo_trial_status` (`subscription_status`,`trial_ends_at`),
  KEY `idx_dojo_subscription_ends` (`subscription_ends_at`),
  CONSTRAINT `dojo_chk_1` CHECK (json_valid(`oeffnungszeiten`)),
  CONSTRAINT `dojo_chk_2` CHECK (json_valid(`zahlungsarten`))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dojo`
--

LOCK TABLES `dojo` WRITE;
/*!40000 ALTER TABLE `dojo` DISABLE KEYS */;
INSERT INTO `dojo` VALUES (2,'Tiger & Dragon Association - International','dojo-2','Sascha Schreiner','Geigelsteinstr. ','14','84137','Vilsbbiburg','015752461776','','headquarter@tda-intl.com','https://www.tda-intl.com','','',2004,0,'Deutschland','','info@tda-intl.com','','',NULL,NULL,'',NULL,0,0,0,NULL,'Einzelunternehmen','','','','','','','','',NULL,NULL,NULL,'','','','','','','',0,'',NULL,NULL,'',NULL,'','Allgemeine Geschäftsbedingungen (AGB)\n\nder Kampfsportschule Schreiner\nOhmstraße 14, 84137 Vilsbiburg\n(im Folgenden „Schule“, „Anbieter“)\n\nStand: 31.10.2025\n\n1. Geltung, Vertragsparteien, Änderungen\n\n1.1. Diese AGB gelten für alle Verträge, Leistungen, Kurse und Mitgliedschaften, die zwischen der Kampfsportschule Schreiner (im Folgenden „Schule“) und den Teilnehmenden bzw. Mitgliedern (im Folgenden „Mitglied“, „Teilnehmer“, „Kunde“) geschlossen werden.\n\n1.2. Abweichende Bedingungen des Kunden werden ausdrücklich zurückgewiesen, es sei denn, die Schule hat ihnen schriftlich ausdrücklich zugestimmt.\n\n1.3. Einzelverträge und schriftliche Vereinbarungen haben Vorrang vor diesen AGB.\n\n1.4. Änderungen oder Ergänzungen dieser AGB bedürfen zur Wirksamkeit der Schriftform, sofern nicht ausdrücklich etwas anderes geregelt ist.\n\n1.5. Die Schule behält sich vor, einzelne Regelungen dieser AGB mit Wirkung für die Zukunft zu ändern. Änderungen werden dem Mitglied mindestens vier Wochen vor Inkrafttreten in Textform (z. B. E‑Mail, Aushang, Post) bekannt gegeben. Widerspricht das Mitglied der Änderung nicht schriftlich bis zum Inkrafttreten, gelten die Änderungen als angenommen. Auf die Bedeutung der Widerspruchsfrist wird die Schule den Teilnehmenden bei Bekanntgabe besonders hinweisen.\n\n2. Vertragsabschluss, Teilnahmevoraussetzungen\n\n2.1. Der Vertrag über die Teilnahme an Kursen, das Training oder eine Mitgliedschaft kommt zustande durch Unterzeichnung eines schriftlichen Vertrags oder eines Anmeldeformulars oder – soweit angeboten – durch Elektronische Anmeldung mit Bestätigung durch die Schule.\n\n2.2. Minderjährige (unter 18 Jahren) dürfen einen Vertrag nur mit Einwilligung der gesetzlichen Vertreter schließen. Diese müssen durch Unterschrift zustimmen.\n\n2.3. Vor Beginn der Teilnahme ist ein Gesundheitsfragebogen/Erklärung zur Sporttauglichkeit durch den Teilnehmenden oder – bei Minderjährigen – durch die gesetzlichen Vertreter auszufüllen. Der Teilnehmende bestätigt damit, dass keine medizinischen Einwände gegen die Teilnahme bestehen, oder er legt ein ärztliches Attest vor, wenn gesundheitliche Risiken bestehen.\n\n2.4. Der Anbieter kann die Teilnahme verweigern, wenn der Gesundheitszustand des Teilnehmenden Bedenken aufwirft, insbesondere wenn eine Gefährdung für sich oder andere bestehen könnte.\n\n3. Leistungsumfang und Nutzung\n\n3.1. Gegenstand der Leistungen sind Trainings-, Kurs- und Unterrichtsangebote im Bereich Kampfsport, Selbstverteidigung, Fitness-Training etc., sowie gegebenenfalls Zusatzleistungen (z. B. Personal Training, Seminare, Prüfungen).\n\n3.2. Der konkrete Leistungsumfang ergibt sich aus dem Vertrag bzw. der Leistungsbeschreibung im Angebot der Schule.\n\n3.3. Die Nutzung der Räumlichkeiten, der Ausstattung und Hilfsmittel erfolgt nur zu dem im Vertrag festgelegten Umfang und nach Maßgabe der Hausordnung.\n\n3.4. Eine Übertragung der Mitgliedschaft oder der Teilnahmeberechtigung auf Dritte ist ausgeschlossen, sofern nichts anderes ausdrücklich vereinbart ist.\n\n4. Pflichten der Mitglieder / Teilnehmer\n\n4.1. Die Mitglieder verpflichten sich insbesondere:\n\ndie Anweisungen der Trainer, Übungsleiter oder des Personals zu befolgen;\n\nsich an die Hausordnung sowie Sicherheits- und Hygienevorschriften zu halten;\n\nkeine Handlungen vorzunehmen, die Gefahr für Leib, Leben oder Eigentum anderer darstellen;\n\nvor oder während der Teilnahme auftretende Unwohlsein, gesundheitliche Beschwerden oder Verletzungen unverzüglich dem Trainer oder der Schule anzuzeigen;\n\neigenes Trainingsmaterial (z. B. geeignete Kleidung, Schutzausrüstung, Getränke) mitzubringen, sofern nicht durch die Schule gestellt;\n\nSauberkeit, Ordnung und Rücksicht auf andere Teilnehmende zu wahren.\n\n4.2. Bei groben oder wiederholten Pflichtverletzungen kann die Schule den Vertrag außerordentlich kündigen (siehe Ziffer 8).\n\n4.3. Das Mitglied ist verpflichtet, Änderungen seiner Kontakt- oder Bankdaten unverzüglich mitzuteilen.\n\n5. Beiträge, Preise, Zahlung\n\n5.1. Die Höhe der Beiträge, Kursgebühren und Zusatzkosten ergibt sich aus der aktuellen Preisliste bzw. dem Vertrag.\n\n5.2. Die Beiträge sind regelmäßig im Voraus – meist monatlich, vierteljährlich oder jährlich – zu entrichten. Der genaue Fälligkeitstermin ergibt sich aus dem Vertrag.\n\n5.3. Bei Zahlungsverzug gelten folgende Regelungen:\n\nNach Mahnung wird eine Mahngebühr (fester Betrag oder Prozentsatz) erhoben;\n\nBei Nichtzahlung kann die Schule den Zutritt verweigern, bis der Rückstand beglichen ist;\n\nNach einer bestimmten Frist (z. B. 2–3 Monate) kann die Schule den Vertrag kündigen und die Rückstände und den restlichen ausstehenden Betrag bis zur Beendigung des Vertrages einfordern.\n\n5.4. Bei Verträgen über einen bestimmten Zeitraum (z. B. Jahresvertrag) wird bei vorzeitiger Beendigung durch das Mitglied keine anteilige Rückerstattung geleistet, sofern nicht ausdrücklich anders vereinbart oder gesetzlich vorgeschrieben.\n\n5.5. Sonderleistungen oder Zusatzangebote (z. B. Privatstunden, Prüfungsgebühren) werden gesondert berechnet und sind ebenfalls fristgerecht zu zahlen.\n\n5.6. Die Schule behält sich vor, Beiträge und Gebühren anzupassen (z. B. wegen gestiegener Kosten). Eine Erhöhung wird dem Mitglied mindestens vier Wochen vorher in Textform mitgeteilt. Widerspricht das Mitglied nicht fristgerecht schriftlich, gilt die Erhöhung als genehmigt. Ein Sonderkündigungsrecht wird nicht gewährleistet.\n\n6. Vertragsdauer und Kündigung\n\n6.1. Vertragsdauer und Kündigungsfristen ergeben sich aus dem jeweiligen Vertrag (z. B. Monat auf Monatsbasis, Mindestvertragsdauer, Laufzeit, Verlängerung).\n\n6.2. Die Kündigung bedarf der Schriftform (Brief, E-Mail, – sofern im Vertrag zugelassen – elektronisch), sofern nicht anders vereinbart.\n\n6.3. Bei Verträgen mit Mindestlaufzeit ist eine ordentliche Kündigung frühestens zum Ende der Mindestlaufzeit möglich. Danach gilt meist eine Kündigungsfrist (z. B. 1–3 Monate).\n\n6.4. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor:\n\nwenn eine Partei ihre vertraglichen Pflichten schwerwiegend verletzt;\n\nbei erheblicher Gesundheitsgefährdung des Mitglieds;\n\nbei Insolvenz oder Einstellung des Geschäftsbetriebs der Schule.\n\n7. Unterbrechung / Ruhen des Vertrages\n\n7.1. In bestimmten Ausnahmefällen (z. B. längere Krankheit, Schwangerschaft, Auslandsaufenthalt) kann der Vertrag auf schriftlichen Antrag und Nachweis befristet ruhen. Die Mindestdauer, Höchstdauer und Bedingungen für einen solchen „Freeze“ sind im Vertrag oder der Preisliste festzulegen.\n\n7.2. Für Ruhtage ist in der Regel ein Entgelt bzw. Verwaltungskosten oder ein reduzierter Beitrag zu erheben.\n\n7.3. Während der Ruhezeiten besteht kein Anspruch auf Nutzung der Leistungen, es sei denn, es wird ausdrücklich etwas Anderes vereinbart.\n\n8. Haftung, Versicherung, Ausschluss\n\n8.1. Die Schule haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung oder auf Vorsatz/Grobe Fahrlässigkeit der Schule oder ihrer Erfüllungsgehilfen beruhen.\n\n8.2. Für sonstige Schäden haftet die Schule nur bei Vorsatz oder grober Fahrlässigkeit, es sei denn, eine Pflichtverletzung betrifft eine wesentliche Vertragspflicht (Kardinalpflicht). In diesem Fall ist die Haftung auf den typischerweise vorhersehbaren Schaden begrenzt.\n\n8.3. Eine Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit gesetzlich zulässig.\n\n8.4. Insbesondere haftet die Schule nicht für:\n\nVerletzungen oder Schäden, die durch Zuwiderhandlung gegen Anweisungen, Regeln oder Sicherheitsvorgaben oder durch den Körperkontakt im Kampftraining entstehen;\n\nSchäden, die durch eigenes fahrlässiges Verhalten des Mitglieds verursacht werden;\n\nSchäden an mitgebrachten Gegenständen oder Wertgegenständen (z. B. Kleidung, Schmuck, elektronische Geräte), sofern nicht grobe Fahrlässigkeit oder Vorsatz vorliegt.\n\n8.5. Der Teilnehmende ist verpflichtet, eigene Unfall- und Haftpflichtversicherung zu haben, soweit möglich, und ggf. Schädenmeldungspflichten zu erfüllen.\n\n9. Aussetzung und Ersatztraining\n\n9.1. Die Schule kann aufgrund von Betriebsstörungen, behördlichen Anordnungen, außergewöhnlichen Ereignissen (z. B. Unwetter, Pandemien), Krankheit von Trainern oder aus anderen wichtigen Gründen den Trainingsbetrieb ganz oder teilweise unterbrechen.\n\n9.2. In solchen Fällen kann die Schule nach Möglichkeit Ersatztermine oder alternative Angebote anbieten oder eine anteilige Gutschrift bzw. Beitragsminderung gewähren.\n\n9.3. Der Anspruch auf Ersatzleistung erlischt, wenn das Mitglied die Ersatzangebote nicht innerhalb einer angemessenen Frist in Anspruch nimmt, ohne ein berechtigtes Hindernis geltend zu machen.\n\n10. Widerrufsrecht für Verbraucher\n\n10.1. Sofern ein Vertrag online oder außerhalb von Geschäftsräumen mit einem Verbraucher geschlossen wird, steht dem Verbraucher ein gesetzliches Widerrufsrecht zu (vgl. §§ 312g, 355 BGB).\n\n10.2. Die Widerrufsbelehrung und die Bedingungen zum Widerruf sind im Vertrag bzw. in der Auftragsbestätigung getrennt darzustellen.\n\n10.3. Das Widerrufsrecht entfällt vollständig bei Verträgen zur Erbringung von Dienstleistungen (z. B. Trainingsleistungen, Mitgliedschaften, Kurse), wenn der Vertrag für eine bestimmte Zeit abgeschlossen ist und die Ausführung der Dienstleistung mit Zustimmung des Verbrauchers beginnt und der Verbraucher seine Kenntnis bestätigt, dass er mit Beginn der Vertragserfüllung sein Widerrufsrecht verliert.\n\n11. Datenschutz\n\n11.1. Die Schule erhebt, verarbeitet und nutzt personenbezogene Daten der Mitglieder nur, soweit dies zur Durchführung des Vertrags nötig ist, gesetzlich erlaubt oder vom Mitglied ausdrücklich genehmigt ist.\n\n11.2. Nähere Einzelheiten zur Datenverarbeitung, Zweckbindung, Speicherung und Rechte der Betroffenen ergeben sich aus der gesonderten Datenschutzinformation / Datenschutzrichtlinie der Schule.\n\n12. Schlussbestimmungen, Salvatorische Klausel, Gerichtsstand, anwendbares Recht\n\n12.1. Sollten einzelne Bestimmungen dieser AGB unwirksam oder undurchführbar sein oder werden, bleibt die Gültigkeit der übrigen Bestimmungen unberührt. Die Parteien verpflichten sich, die unwirksame Regelung durch eine solche wirksame zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen möglichst nahekommt.\n\n12.2. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.\n\n12.3. Soweit gesetzlich zulässig und der Teilnehmende Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist, ist ausschließlicher Gerichtsstand der Sitz der Schule (Vilsbiburg). Andernfalls gelten die gesetzlichen Gerichtsstände.\n\n12.4. Änderungen oder Ergänzungen des Vertrags, einschließlich dieser Klausel, bedürfen der Schriftform.',NULL,NULL,'Impressum\n\nAngaben gemäß § 5 TMG / § 55 RStV\n\nTiger & Dragon Association – International\nInhaber / Verantwortlicher: Sascha Schreiner\nGeigelsteinstr. 14\n84137 Vilsbiburg\nDeutschland\n\nKontakt:\nTelefon: 01575 2461776\nE-Mail: info@tda-intl.com\n\nWebseite: www.tda-intl.com\n\nVertretungsberechtigt\n\nSascha Schreiner\n(Inhaber, Verbandrepräsentant)\n\nUmsatzsteuer / Steuernummer\n\n\n\nInhaltlich Verantwortlicher gemäß § 55 Abs. 2 RStV\n\nSascha Schreiner\nGeigelsteinstr. 14\n84137 Vilsbiburg\n\nHaftung für Inhalte\n\nAls Dienstanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.\nNach §§ 8–10 TMG sind wir jedoch nicht verpflichtet,\n\nübermittelte oder gespeicherte fremde Informationen zu überwachen oder\n\nnach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.\n\nVerpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.\nEine Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich.\nBei Bekanntwerden entsprechender Rechtsverletzungen entfernen wir diese Inhalte umgehend.\n\nHaftung für Links\n\nUnser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.\nDeshalb können wir für diese fremden Inhalte keine Gewähr übernehmen.\n\nFür die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.\nBei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links sofort.\n\nUrheberrecht\n\nDie auf dieser Website veröffentlichten Inhalte, Bilder, Texte, Grafiken, Logos und Designs unterliegen dem deutschen Urheberrecht.\nVervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Rechteinhabers.\n\nDownloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.\n\nMarken- und Schutzrechte\n\n„Tiger & Dragon Association“ sowie sämtliche Logos, Abzeichen und Titel können geschützte Marken oder eingetragene Kennzeichen sein.\nJede unbefugte Nutzung ist untersagt.\n\nOnline-Streitbeilegung\n\nDie Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:\nhttps://ec.europa.eu/consumers/odr\n\nWir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.\n\nGender-Hinweis\n\nAus Gründen der Lesbarkeit wird in Texten auf dieser Seite überwiegend die männliche Form gewählt.\nAlle personenbezogenen Bezeichnungen gelten gleichermaßen für alle Geschlechter.',3,12,14,NULL,1,0,'','','','','','','','',0,'','','','',0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,5.00,10.00,'',NULL,'#DAA520','de','Europe/Berlin','EUR',NULL,'',500,20,50,1,1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-19 06:34:23','2026-01-08 19:21:43',NULL,'1.0','stripe_datev','sk_test_example','pk_test_example','datev_test_key','12345','123','1. Verantwortlicher\n\nTiger & Dragon Association – International\nInhaber / Verantwortlicher: Sascha Schreiner\nAnschrift: Geigelsteinstr. 14, 84137 Vilsbiburg, Deutschland\nTelefon: +49 (0)1575 2461776\nE-Mail: info@tda-intl.com\n\nWebseite: www.tda-intl.com\n\n(im Folgenden „wir“, „uns“ oder „TDA Int’l“)\n\n2. Geltungsbereich\n\nDiese Datenschutzerklärung informiert dich darüber, welche personenbezogenen Daten wir erheben, wenn du\n\nunsere Webseite www.tda-intl.com\n besuchst,\n\ndich oder deine Schule/deinen Verein zu unseren Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events oder anderen Events anmeldest,\n\nmit uns per E-Mail, Telefon, Kontaktformular oder auf andere Weise in Kontakt trittst,\n\nMitglied im Verband wirst oder als Partner/Instructor mit uns zusammenarbeitest.\n\nSie gilt insbesondere im Rahmen der Datenschutz-Grundverordnung (DSGVO) und des Bundesdatenschutzgesetzes (BDSG).\n\n3. Begriffe\n\n„Personenbezogene Daten“ sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen (z. B. Name, Adresse, E-Mail, IP-Adresse).\n\n„Verarbeitung“ ist jeder Vorgang im Zusammenhang mit personenbezogenen Daten (z. B. Erheben, Speichern, Übermitteln, Löschen).\n\n4. Rechtsgrundlagen der Verarbeitung\n\nWir verarbeiten personenbezogene Daten auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO – Einwilligung\n\nArt. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung oder vorvertragliche Maßnahmen (z. B. Turnieranmeldung, Mitgliedsantrag)\n\nArt. 6 Abs. 1 lit. c DSGVO – rechtliche Verpflichtung (z. B. Aufbewahrungspflichten)\n\nArt. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse\n(z. B. sichere Bereitstellung der Webseite, Organisation von Veranstaltungen, Außendarstellung, Verbandsverwaltung)\n\n5. Bereitstellung der Webseite und Server-Logfiles\n5.1 Art der Daten\n\nBeim Besuch unserer Webseite werden durch den von dir verwendeten Browser automatisch Informationen an unseren Server übermittelt und in Server-Logfiles gespeichert. Dies sind u. a.:\n\nIP-Adresse deines Endgeräts\n\nDatum und Uhrzeit des Zugriffs\n\naufgerufene Seite/Datei\n\nReferrer-URL (zuvor besuchte Seite, falls übermittelt)\n\nverwendeter Browser und Betriebssystem\n\nggf. Name deines Access-Providers\n\nDiese Daten werden nicht mit anderen Datenquellen zusammengeführt und nicht zur Identifizierung einzelner Personen verwendet.\n\n5.2 Zweck\n\nSicherstellung eines reibungslosen Verbindungsaufbaus der Webseite\n\nGewährleistung einer komfortablen Nutzung unserer Webseite\n\nAuswertung der Systemsicherheit und -stabilität\n\ntechnische Administration\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und stabilen Betrieb der Webseite).\n\n5.3 Speicherdauer\n\nServer-Logfiles werden in der Regel für 7–30 Tage gespeichert und anschließend automatisch gelöscht, sofern keine längere Aufbewahrung zu Beweiszwecken im Einzelfall erforderlich ist (z. B. bei Sicherheitsvorfällen).\n\n6. Cookies und Einwilligungs-Management\n6.1 Cookies\n\nUnsere Webseite kann sogenannte Cookies verwenden. Das sind kleine Textdateien, die auf deinem Endgerät gespeichert werden.\n\nArten von Cookies:\n\nTechnisch notwendige Cookies\nz. B. zur Sprachauswahl, Sitzungserkennung, Warenkorb-/Formularfunktionen, Login-Bereich\n→ Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO oder § 25 Abs. 2 TTDSG\n\nOptionale Cookies (z. B. für Statistik/Analyse oder Marketing) – falls eingesetzt\n→ Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 25 Abs. 1 TTDSG (nur mit Einwilligung)\n\n6.2 Cookie-Einwilligung\n\nSofern wir ein Cookie-Banner / Consent-Tool einsetzen, kannst du dort entscheiden, welchen Kategorien von Cookies du zustimmst. Deine Auswahl kannst du jederzeit über die entsprechenden Einstellungen im Consent-Tool oder in deinem Browser ändern.\n\n7. Kontaktaufnahme (E-Mail, Telefon, Kontaktformular)\n\nWenn du uns kontaktierst, z. B. per E-Mail, Telefon oder Kontaktformular, verarbeiten wir die von dir mitgeteilten Daten:\n\nName\n\nKontaktdaten (E-Mail, Telefonnummer)\n\nBetreff und Inhalt deiner Nachricht\n\nggf. Vereins-/Dojo-Name, Land, Funktion (Instructor, Schüler, Funktionär usw.)\n\nZweck der Verarbeitung ist die Bearbeitung deines Anliegens, Rückfragen und Kommunikation.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO, sofern deine Anfrage mit der Durchführung eines Vertrages oder vorvertraglicher Maßnahmen zusammenhängt (z. B. Turnieranmeldung, Mitgliedsantrag).\n\nArt. 6 Abs. 1 lit. f DSGVO, bei allgemeinen Anfragen (berechtigtes Interesse an effektiver Kommunikation).\n\nSpeicherdauer:\nWir speichern deine Anfrage, solange es zur Bearbeitung erforderlich ist. Danach werden die Daten regelmäßig gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.\n\n8. Mitgliedschaft, Verband, Schulen & Partner\n\nWenn du Mitglied bei TDA Int’l wirst oder als Dojo/Schule/Instructor mit uns zusammenarbeitest, verarbeiten wir – je nach Rolle – insbesondere:\n\nStammdaten: Name, Adresse, Geburtsdatum, Kontaktdaten (Telefon, E-Mail)\n\nVerbandsbezogene Daten: Dojo-/Vereinsname, Stilrichtung(en), Position im Verband, Mitgliedsstatus, Funktion (Instructor, Schulleiter, Funktionär)\n\nVertrags- und Abrechnungsdaten: Bankverbindung, Zahlungsinformationen (z. B. Beitragszahlungen), ggf. Rechnungen\n\nKommunikationsdaten: Schriftwechsel im Zusammenhang mit der Mitgliedschaft/Kooperation\n\nZweck:\n\nVerwaltung von Mitgliedern, Schulen und Partnern\n\nDurchführung des Mitgliedschafts- oder Kooperationsverhältnisses\n\nOrganisation von Veranstaltungen, Ernennungen, Lizenzen, Instructor-Tätigkeiten\n\nAbrechnung und Beitragseinzug\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und ggf. Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten, z. B. steuerliche Aufbewahrung).\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Mitgliedschaft/Kooperation und darüber hinaus für gesetzliche Aufbewahrungsfristen (in der Regel 6–10 Jahre) gespeichert. Daten, die nicht mehr benötigt werden, werden gelöscht oder anonymisiert.\n\n9. Online-Anmeldung zu Turnieren, Seminaren, Hall of Fame & Events\n\nZur Anmeldung zu unseren Turnieren, Hall-of-Fame-Veranstaltungen, Seminaren, Charity-Events und weiteren Events erheben wir je nach Event folgende Daten von Teilnehmern, Trainern, Vereinen/Schulen:\n\nPersonendaten der Teilnehmer*innen:\nName, Vorname, Geburtsdatum, Geschlecht, Nationalität\n\nSportbezogene Daten:\nStilrichtung, Graduierung/Gürtel, Gewichtsklasse, Startkategorien, Wettkampfklassen, ggf. Leistungsstand\n\nKontaktdaten:\nAnschrift, E-Mail, Telefonnummer des Teilnehmers oder Vereins/Trainers\n\nVereins-/Dojo-Daten:\nName, Anschrift, Ansprechpartner, Verband, Land\n\nAbrechnungsdaten:\nTeilnahmegebühren, Zahlungsinformationen (z. B. Vermerk über Zahlungseingang – konkrete Zahlungsdaten beim Zahlungsdienstleister)\n\nZwecke der Verarbeitung:\n\nOrganisation und Durchführung der Veranstaltung\n\nErstellung von Startlisten, Pools, Kampffeldern und Zeitplänen\n\nErgebniserfassung, Ranglisten, Siegerehrungen, Urkunden\n\nKommunikation mit Teilnehmern, Vereinen und Offiziellen\n\nAbrechnung und ggf. Nachweis gegenüber Sponsoren, Partnern oder Verbänden\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung – Durchführung der Veranstaltung)\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer professionellen Organisation und sportlichen Auswertung)\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Veranstaltungsorganisation sowie für die Dokumentation von Ergebnissen (z. B. Ranglisten, Jahreswertung, Hall of Fame) gespeichert. Soweit möglich, werden Langzeitauswertungen in anonymisierter oder pseudonymisierter Form geführt. Rechts- und steuerrelevante Daten bewahren wir gemäß der gesetzlichen Fristen auf.\n\n10. Hall of Fame, Berichterstattung, Fotos & Videos\n\nIm Rahmen von Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events und sonstigen Veranstaltungen erstellen wir ggf. Fotos und Videos, u. a. für:\n\nBerichte zu Veranstaltungen auf unserer Webseite, in Social Media, in Newslettern oder Printmedien\n\nDokumentation sportlicher Leistungen und Ehrungen\n\nArchivzwecke und Hall-of-Fame-Einträge\n\nDabei können Teilnehmer, Trainer, Offizielle, Gäste und Ehrengäste erkennbar sein.\n\nRechtsgrundlagen:\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Berichterstattung, Außendarstellung, Dokumentation des Verbandslebens)\n\nsoweit erforderlich: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. bei Portraitaufnahmen, Nahaufnahmen oder bestimmten Veröffentlichungen)\n\nWenn du nicht fotografiert werden möchtest oder mit einer Veröffentlichung nicht einverstanden bist, kannst du uns das möglichst frühzeitig mitteilen (z. B. an der Anmeldung, beim Fotografen oder per E-Mail). Bereits veröffentlichte Inhalte prüfen wir im Einzelfall und entfernen sie, sofern keine überwiegenden berechtigten Interessen entgegenstehen.\n\n11. Newsletter & Informationsmails (falls eingesetzt)\n\nSofern wir einen Newsletter oder regelmäßige Informationsmails anbieten, gilt:\n\nFür den Versand benötigen wir deine E-Mail-Adresse und ggf. deinen Namen.\n\nDie Anmeldung erfolgt in der Regel über ein Double-Opt-In-Verfahren: Erst nach Bestätigung deiner E-Mail-Adresse erhältst du den Newsletter.\n\nDu kannst dich jederzeit vom Newsletter abmelden, z. B. über einen Abmeldelink in jeder E-Mail oder durch Nachricht an uns.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung)\n\nSpeicherdauer:\nWir speichern deine Daten, bis du dich vom Newsletter abmeldest oder deine Einwilligung widerrufst.\n\n12. Nutzerkonten / Login-Bereich (falls vorhanden)\n\nWenn wir einen geschützten Login-Bereich für Vereine/Instruktoren/Teilnehmer anbieten, verarbeiten wir:\n\nZugangsdaten (Benutzername, Passwort – Passwort nur in verschlüsselter Form)\n\nRegistrierungsdaten (Name, E-Mail, Verein, Rolle im System)\n\nNutzungsdaten (z. B. erfasste Teilnehmer, Meldungen, Bearbeitungen im System)\n\nZweck: Bereitstellung des geschützten Bereichs, Verwaltung von Meldungen, Administration von Turnieren und Verbandsdaten.\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzervertrag für den Login-Bereich) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherer Systemverwaltung).\n\n13. Zahlungsabwicklung (falls über Zahlungsdienstleister)\n\nSofern Teilnahmegebühren, Mitgliedsbeiträge oder andere Leistungen über Zahlungsdienstleister oder Kreditinstitute abgewickelt werden, werden die hierfür erforderlichen Daten (z. B. Name, Betrag, IBAN/BIC oder andere Zahlungsinformationen) an das jeweilige Unternehmen übermittelt.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung – Zahlungsabwicklung)\n\nArt. 6 Abs. 1 lit. c DSGVO (gesetzliche Aufbewahrungspflichten)\n\nDie detaillierte Verarbeitung erfolgt beim jeweiligen Zahlungsdienstleister. Bitte beachte ergänzend deren Datenschutzhinweise.\n\n14. Webanalyse & Tracking (falls eingesetzt)\n\nSofern wir Webanalyse-Dienste (z. B. zur statistischen Auswertung der Nutzung unserer Webseite) verwenden, geschieht dies nur auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung, falls Cookies/Tracking erforderlich) oder\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer bedarfsgerechten Gestaltung und Optimierung der Webseite), soweit dies ohne Einwilligung zulässig ist.\n\nDie konkrete Ausgestaltung (Dienstleister, Umfang der Datenverarbeitung, Speicherdauer, ggf. Drittlandtransfer) wird in einem separaten Abschnitt oder im Cookie-Banner erläutert, sobald diese Dienste eingesetzt werden.\n\n15. Empfänger der Daten / Auftragsverarbeiter\n\nWir geben personenbezogene Daten nur an Dritte weiter, soweit dies\n\nzur Vertragserfüllung notwendig ist (z. B. Dienstleister für IT, Hosting, Zahlungsabwicklung, Urkundendruck, Versand),\n\nwir dazu gesetzlich verpflichtet sind (z. B. Behörden, Finanzamt),\n\nes zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist oder\n\ndu eingewilligt hast.\n\nMit Dienstleistern, die in unserem Auftrag personenbezogene Daten verarbeiten, schließen wir Auftragsverarbeitungsverträge gemäß Art. 28 DSGVO.\n\n16. Datenübermittlung in Drittländer\n\nDa wir ein internationaler Verband sind und Mitglieder, Schulen und Partner weltweit vertreten, kann es in Einzelfällen zu einer Übermittlung von personenbezogenen Daten in Länder außerhalb der EU/des EWR kommen (z. B. zur Koordination internationaler Events oder zur Kommunikation mit Landesvertretungen).\n\nIn solchen Fällen achten wir besonders darauf, dass\n\nentweder ein Angemessenheitsbeschluss der EU-Kommission vorliegt oder\n\ngeeignete Garantien nach Art. 46 DSGVO bestehen (z. B. EU-Standardvertragsklauseln) oder\n\neine Einwilligung der betroffenen Person vorliegt bzw. eine andere gesetzliche Grundlage besteht.\n\n17. Speicherdauer und Löschung der Daten\n\nWir verarbeiten und speichern personenbezogene Daten nur für den Zeitraum, der zur Zweck­erfüllung erforderlich ist oder sofern dies in Gesetzen, Verordnungen oder anderen Vorschriften vorgesehen ist.\n\nKriterien für die Speicherdauer sind u. a.:\n\nDauer der Mitgliedschaft oder Zusammenarbeit\n\ngesetzliche Aufbewahrungspflichten (z. B. handels- und steuerrechtlich meist 6–10 Jahre)\n\nBedeutung für die Dokumentation sportlicher Leistungen (z. B. Hall-of-Fame-Einträge, historische Ranglisten)\n\nNach Wegfall des Zwecks bzw. Ablauf gesetzlicher Fristen werden die Daten gelöscht oder anonymisiert.\n\n18. Datensicherheit\n\nWir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um deine Daten gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder unbefugten Zugriff zu schützen.\n\nUnsere Webseite verwendet in der Regel SSL-/TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennst du z. B. an „https://“ und einem Schloss-Symbol im Browser.\n\n19. Deine Rechte als betroffene Person\n\nDir stehen nach der DSGVO insbesondere folgende Rechte zu:\n\nAuskunft (Art. 15 DSGVO)\nDu kannst Auskunft darüber verlangen, ob und welche personenbezogenen Daten wir über dich verarbeiten.\n\nBerichtigung (Art. 16 DSGVO)\nDu kannst die Berichtigung unrichtiger oder Vervollständigung unvollständiger Daten verlangen.\n\nLöschung (Art. 17 DSGVO)\nDu kannst unter bestimmten Voraussetzungen die Löschung deiner Daten verlangen („Recht auf Vergessenwerden“).\n\nEinschränkung der Verarbeitung (Art. 18 DSGVO)\nDu kannst in bestimmten Fällen die Einschränkung der Verarbeitung verlangen.\n\nDatenübertragbarkeit (Art. 20 DSGVO)\nDu kannst verlangen, dass wir dir die Daten, die du uns bereitgestellt hast, in einem strukturierten, gängigen und maschinenlesbaren Format übermitteln oder an einen anderen Verantwortlichen übertragen.\n\nWiderspruchsrecht (Art. 21 DSGVO)\nDu hast das Recht, aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit gegen die Verarbeitung deiner personenbezogenen Daten, die wir auf Grundlage von Art. 6 Abs. 1 lit. e oder f DSGVO vornehmen, Widerspruch einzulegen.\nWir verarbeiten die personenbezogenen Daten dann nicht mehr, es sei denn, es liegen zwingende schutzwürdige Gründe vor oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.\n\nWiderruf von Einwilligungen (Art. 7 Abs. 3 DSGVO)\nEine einmal erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.\n\nBeschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO)\nDu hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren, wenn du der Ansicht bist, dass die Verarbeitung der dich betreffenden Daten gegen Datenschutzrecht verstößt.\n\n20. Pflicht zur Bereitstellung von Daten\n\nIn manchen Fällen ist die Bereitstellung personenbezogener Daten erforderlich, z. B. zur:\n\nAnmeldung zu Turnieren, Seminaren oder Veranstaltungen\n\nBearbeitung eines Mitgliedsantrags\n\nErfüllung vertraglicher oder gesetzlicher Pflichten\n\nWenn du die erforderlichen Daten nicht bereitstellst, kann es sein, dass wir die gewünschte Leistung (z. B. Teilnahme an einem Turnier, Mitgliedschaft, Nutzung des Login-Bereichs) nicht erbringen können.\n\n21. Änderungen dieser Datenschutzerklärung\n\nWir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder Änderungen unserer Leistungen (z. B. Einführung neuer Dienste) widerspiegelt.\n\nFür deinen erneuten Besuch gilt dann die jeweils aktuelle Version der Datenschutzerklärung.\n\nStand: 11.12.2025','🥋 Dojo-Regeln der Tiger & Dragon Association – International\n1. Respekt ist Grundvoraussetzung\n\nWir begegnen allen Menschen im Dojo mit Respekt – unabhängig von Herkunft, Alter, Geschlecht, Graduierung oder körperlicher Fähigkeit.\nRespekt beginnt beim Betreten des Dojos und endet erst beim Verlassen.\n\n2. Verbeugung (Rei) als Zeichen der Wertschätzung\n\nBeim Betreten und Verlassen der Matte wird verbeugt.\nDie Verbeugung gilt dem Dojo, dem Weg und den Trainingspartnern.\n\n3. Pünktlichkeit ist Pflicht\n\nDas Training beginnt pünktlich.\nWer zu spät kommt, wartet am Mattenrand auf das Zeichen des Trainers, bevor er das Training betritt.\n\n4. Aufmerksamkeit und Disziplin\n\nWährend des Trainings wird:\n\nnicht geredet, wenn der Trainer erklärt\n\nvollständig zugehört\n\nkonzentriert gearbeitet\n\nstörendes Verhalten vermieden\n\nDer Weg der Kampfkunst beginnt mit Disziplin.\n\n5. Sauberkeit & Ordnung\n\nDie Matte wird nur sauber und mit gewaschenen Füßen betreten.\n\nHände und Füße sind gepflegt, Nägel kurz.\n\nDer Gi / die Trainingskleidung muss sauber, vollständig und ordentlich sein.\n\nDas Dojo wird sauber gehalten – jeder hilft mit.\n\n6. Kein Schmuck, keine Gefahrenquellen\n\nAus Sicherheitsgründen werden Schmuck, Uhren, Piercings oder andere Gegenstände abgelegt oder abgeklebt.\n\n7. Achte auf deinen Partner\n\nDer Trainingspartner ist kein Gegner – er ist dein Lehrer.\nWir trainieren kontrolliert, achtsam und verantwortungsvoll.\nWer aggressiv oder gefährlich trainiert, wird aus dem Training entfernt.\n\n8. Schutzausrüstung tragen\n\nBeim Sparring und in Kampfeinheiten ist die vorgeschriebene Schutzausrüstung verpflichtend.\n\n9. Techniken nur mit Erlaubnis\n\nGefährliche Techniken, Würfe, Joint Locks oder harte Sparringseinheiten dürfen nur mit Zustimmung des Trainers ausgeführt werden.\n\n10. Training auf eigene Verantwortung\n\nJeder trainiert im Rahmen seiner Möglichkeiten.\nSchmerzen, Verletzungen oder gesundheitliche Probleme müssen sofort gemeldet werden.\n\n11. Kein Essen auf der Matte\n\nTrinken ist erlaubt – aber nur in Pausen und außerhalb der Mattenfläche.\nEssen, Süßigkeiten oder Kaugummi haben im Dojo nichts verloren.\n\n12. Konzentration – kein Handy, kein Stress\n\nHandys bleiben lautlos, in der Tasche und außerhalb der Trainingsfläche.\nDas Dojo ist ein Ort innerer Ruhe und Fokus.\n\n13. Hilfsbereitschaft\n\nFortgeschrittene unterstützen Anfänger.\nJeder hilft jedem – das Dojo ist eine Familie.\n\n14. Verhalten gegenüber Trainern\n\nDer Trainer trägt die Verantwortung für das Training.\nSeine Anweisungen sind jederzeit zu befolgen.\nKritik wird respektvoll und außerhalb des Trainings geäußert.\n\n15. Verhaltenskodex außerhalb des Dojos\n\nEin Mitglied der TDA Int’l repräsentiert den Verband – auch außerhalb des Dojos.\nEhre, Respekt und Disziplin gelten überall, nicht nur auf der Matte.\n\n16. Keine unangekündigten Demonstrationen von Techniken\n\nTechniken werden nicht ohne Anweisung oder Partner ausgeführt, um Unfälle zu vermeiden.\n\n17. Grüßen der Trainer\n\nDer Unterricht beginnt und endet mit einer gemeinsamen Verbeugung.\nWer den Unterricht früher verlassen muss, meldet sich vorher beim Trainer ab und verneigt sich.\n\n18. Richtiges Verhalten bei Verletzungen\n\nSofort stoppen\n\nLaut und klar melden\n\nPartner schützen\n\nTrainer informieren\n\n19. Kein Training bei Krankheit\n\nBei Fieber, ansteckenden Erkrankungen oder Verletzungen darf nicht trainiert werden.\n\n20. Der Weg (Do) ist wichtiger als der Sieg\n\nWettkämpfe sind Teil des Weges, aber nicht der Zweck der Kampfkunst.\nEntwicklung, Charakterbildung und gegenseitiger Respekt stehen im Vordergrund.\n\n21. Respektiere das Dojo\n\nDas Dojo ist ein besonderer Ort, kein Fitnessstudio.\nHier wird nicht geflucht, gelärmt oder respektlos gehandelt.\n\nSchlusswort\n\nDie Dojo-Regeln sind ein zentraler Bestandteil der Tiger & Dragon Association – International.\nSie dienen dem Schutz, der Tradition und dem Wachstum jedes einzelnen Schülers.\n\nMit dem Betreten des Dojos werden diese Regeln anerkannt und gelebt.','Hausordnung der Tiger & Dragon Association – International\n\nDie nachfolgenden Regeln dienen der Sicherheit, Sauberkeit, Fairness und einem respektvollen Miteinander im gesamten Trainings- und Veranstaltungsbetrieb der Tiger & Dragon Association – International (im Folgenden „TDA Int’l“).\n\nMit dem Betreten der Trainingsräume, Hallen oder Veranstaltungsorte erkennt jeder Teilnehmer, Besucher, Schüler, Trainer und Angehörige diese Hausordnung an.\n\n1. Allgemeines Verhalten\n\nRespekt, Höflichkeit und ein freundlicher Umgangston sind verpflichtend.\n\nAnweisungen des Trainers, der Aufsichtspersonen und des Veranstalters sind unbedingt zu befolgen.\n\nJede Form von Gewalt, Diskriminierung, Mobbing, Provokation oder respektlosem Verhalten wird nicht toleriert.\n\nBesucher und Teilnehmer haben sich so zu verhalten, dass niemand gefährdet, gestört oder beeinträchtigt wird.\n\nAlkohol, Drogen und andere berauschende Mittel sind auf dem Gelände verboten. Personen unter Einfluss solcher Substanzen werden vom Training ausgeschlossen.\n\n2. Sauberkeit & Ordnung\n\nDie Trainingsräume sind sauber zu halten.\n\nSchuhe sind nur in den dafür vorgesehenen Bereichen erlaubt – auf der Matte herrscht Barfußpflicht (Ausnahmen: medizinische Gründe, spezielle Matten-Schuhe).\n\nTaschen, Kleidung und persönliche Gegenstände sind ordnungsgemäß abzulegen und keine Stolpergefahr zu verursachen.\n\nJeder ist für die Sauberkeit seines Platzes und seiner Ausrüstung selbst verantwortlich.\n\nMüll bitte in die vorgesehenen Behälter werfen.\n\n3. Kleidung & Ausrüstung\n\nEs ist ordnungsgemäße Trainingskleidung zu tragen (z. B. Gi, Hose, Verbandskleidung, Schul-T-Shirt).\n\nDie Kleidung muss sauber, intakt und geruchsneutral sein.\n\nSchutzausrüstung (z. B. Handschuhe, Mundschutz, Tiefschutz, Schienbeinschoner) ist bei bestimmten Trainingseinheiten verpflichtend.\n\nSchmuck (Ringe, Ketten, Ohrringe, Piercings etc.) ist aus Sicherheitsgründen abzulegen oder abzukleben.\n\nLängere Haare müssen zusammengebunden sein.\n\n4. Sicherheit & Gesundheit\n\nTraining erfolgt stets auf eigene Gefahr; jeder achtet auf die eigenen körperlichen Grenzen.\n\nVerletzungen oder gesundheitliche Probleme müssen dem Trainer sofort gemeldet werden.\n\nDas Trainieren mit ansteckenden Krankheiten, offenen Wunden oder Fieber ist nicht erlaubt.\n\nGefährliche Techniken dürfen nur unter Aufsicht eines Trainers ausgeführt werden.\n\nWildes, unkontrolliertes oder aggressives Verhalten führt zum sofortigen Ausschluss aus dem Training.\n\n5. Matten- und Trainingsregeln\n\nDie Matte darf nur mit sauber gewaschenen Füßen betreten werden.\n\nEssen, Trinken (außer Wasser) und Kaugummi sind auf der Matte verboten.\n\nDas Verlassen der Matte während des Trainings muss beim Trainer angezeigt werden.\n\nSparring findet nur mit Erlaubnis des Trainers statt und unter Beachtung der festgelegten Regeln.\n\nEin fairer, verantwortungsvoller Umgang mit Trainingspartnern ist Pflicht.\n\n6. Verhalten gegenüber Trainern & Schülern\n\nDer Trainer ist während der Trainingseinheit weisungsbefugt.\n\nKritik oder Hinweise sind respektvoll und ausschließlich sachlich zu äußern.\n\nSchüler unterstützen und respektieren sich gegenseitig – unabhängig von Stil, Gürtelgrad, Herkunft, Geschlecht oder körperlicher Verfassung.\n\nDie höhere Graduierung verpflichtet zu Vorbildverhalten.\n\n7. Minderjährige Teilnehmer\n\nEltern oder Erziehungsberechtigte tragen die Verantwortung für die Aufsicht ihrer Kinder außerhalb des Trainings.\n\nKinder dürfen die Matten, Geräte und Räumlichkeiten nicht unbeaufsichtigt nutzen.\n\nUnnötiges Herumrennen im Dojo oder Wartebereich ist zu vermeiden.\n\nEltern dürfen das Training beobachten, aber die Einheit nicht stören.\n\n8. Geräte & Einrichtung\n\nTrainingsgeräte dürfen nur sachgerecht und vorsichtig benutzt werden.\n\nBeschädigungen sind sofort zu melden.\n\nMutwillige Beschädigungen führen zu Schadensersatzforderungen.\n\nGeräte müssen nach Benutzung an ihren Platz zurückgelegt werden.\n\n9. Garderobe & Wertsachen\n\nFür verloren gegangene oder gestohlene Gegenstände übernimmt TDA Int’l keine Haftung.\n\nWertsachen sind selbst zu sichern oder nicht mitzuführen.\n\nDer Umkleidebereich ist sauber zu halten.\n\n10. Fotos, Videos & Öffentlichkeitsarbeit\n\nDas Filmen oder Fotografieren im Dojo ist nur mit Erlaubnis des Trainers oder Verbandes erlaubt.\n\nBei offiziellen Veranstaltungen dürfen von TDA Int’l Fotos und Videos für Öffentlichkeitsarbeit erstellt werden.\n\nTeilnehmer können der Verwendung widersprechen, sofern keine berechtigten Interessen entgegenstehen.\n\n11. Teilnahmeausschluss & Sanktionen\n\nBei Verstößen gegen diese Hausordnung kann TDA Int’l folgende Maßnahmen ergreifen:\n\nmündliche Verwarnung\n\nschriftliche Verwarnung\n\nAusschluss aus der Trainingseinheit\n\ntemporärer Trainingsverweis\n\nHausverbot\n\nfristlose Beendigung der Mitgliedschaft\n\nEin Anspruch auf Rückerstattung der Beiträge besteht nicht.\n\n12. Notfälle\n\nNotausgänge dürfen nicht blockiert werden.\n\nIm Notfall ist den Anweisungen des Personals Folge zu leisten.\n\nErste-Hilfe-Material ist nur im Ernstfall zu verwenden.\n\n13. Gültigkeit\n\nDiese Hausordnung gilt für:\n\nalle Trainingsräume und Hallen\n\nOutdoor-Trainingsbereiche\n\nWettkampf- und Eventorte\n\nSeminarräume\n\nVeranstaltungen, Turniere und Prüfungen\n\nalle Teilnehmer, Besucher und Mitglieder der Tiger & Dragon Association – International\n\nMit dem Betreten der Räumlichkeiten bzw. Teilnahme an Aktivitäten wird die Hausordnung anerkannt.','Widerrufsbelehrung mit Hinweis auf sofortigen Trainingsbeginn\n\nWiderrufsrecht\n\nDu hast das Recht, deine Mitgliedschaft innerhalb von 14 Tagen ohne Angabe von Gründen zu widerrufen.\n\nDie Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.\n\nUm dein Widerrufsrecht auszuüben, musst du uns (Tiger & Dragon Association – International, Geigelsteinstr. 14, 84137 Vilsbiburg, info@tda-intl.com\n) mittels einer eindeutigen Erklärung (z. B. E-Mail oder Brief) über deinen Entschluss informieren, die Mitgliedschaft zu widerrufen.\n\nAusnahme: Verzicht auf das Widerrufsrecht bei sofortigem Trainingsbeginn\n\nWenn du ausdrücklich verlangst, dass die Mitgliedschaft bereits vor Ablauf der Widerrufsfrist beginnt und du sofort am Training teilnehmen möchtest, gilt Folgendes:\n\nDu bestätigst mit deinem Antrag ausdrücklich, dass du vor Ablauf der Widerrufsfrist sofort mit dem Training beginnen möchtest.\n\nDu bestätigst außerdem, dass dir bewusst ist, dass du bei vollständiger Vertragserfüllung durch uns dein Widerrufsrecht verlierst.\n\nFür Leistungen, die wir bis zum Zeitpunkt des Widerrufs bereits erbracht haben, musst du ggf. einen angemessenen anteiligen Betrag zahlen.\n\nBeispiel:\nWenn du nach Vertragsabschluss sofort trainierst und erst später innerhalb der Frist widerrufst, wird nur die bereits in Anspruch genommene Zeit berechnet.\n\nDiese Erklärung ist erforderlich, weil du sonst laut Gesetz erst nach Ablauf der 14 Tage trainieren dürftest.\n\nFolgen des Widerrufs\n\nWenn du die Mitgliedschaft innerhalb der Widerrufsfrist widerrufst, erstatten wir dir alle Zahlungen, abzüglich der anteiligen Kosten für bereits genutzte Leistungen, innerhalb von 14 Tagen ab Eingang deines Widerrufs.\n\nMuster-Widerrufsformular\n\n(Wenn du den Vertrag widerrufen möchtest, fülle folgendes Formular aus und sende es zurück.)\n\nAn:\nTiger & Dragon Association – International\nGeigelsteinstr. 14\n84137 Vilsbiburg\nE-Mail: info@tda-intl.com\n\nHiermit widerrufe ich die von mir abgeschlossene Mitgliedschaft.\n\nName: _______________________________________\n\nAnschrift: __________________________________\n\nDatum des Vertragsabschlusses: _______________\n\nDatum des Widerrufs: ________________________\n\nUnterschrift (bei Mitteilung auf Papier): ___________________________','','regelbesteuerung',19.00,22000.00,0.00,0.00,2025,0,0,1,0,NULL,'#FFD700','','','2026-01-08 20:21:43','default','Haftungsausschluss der Tiger & Dragon Association – International\n1. Allgemeines\n\nDie Teilnahme an sämtlichen Angeboten, Leistungen und Aktivitäten der Tiger & Dragon Association – International (im Folgenden „TDA Int’l“) erfolgt grundsätzlich auf eigene Gefahr.\nDies umfasst insbesondere:\n\nTurniere und Wettkämpfe\n\nTrainings, Kurse, Workshops, Lehrgänge und Seminare\n\nHall-of-Fame-Veranstaltungen und Ehrungen\n\nPrüfungen, Graduierungen und Sparrings\n\nTrainingscamps und Outdoor-Aktivitäten\n\nVereins- und Verbandsveranstaltungen aller Art\n\nMitgliedschaften und Instructor-Programme\n\nFoto-, Video- und Medienaufnahmen\n\nsonstige sportliche oder gemeinschaftliche Veranstaltungen\n\nMit der Teilnahme erkennt jeder Teilnehmer, Erziehungsberechtigter oder Vertreter diesen Haftungsausschluss vollständig an.\n\n2. Gesundheitliche Voraussetzungen und Eigenverantwortung\n\nJeder Teilnehmer bestätigt, dass er:\n\nkörperlich und geistig in der Lage ist, an der jeweiligen Aktivität teilzunehmen,\n\nkeine gesundheitlichen Einschränkungen verheimlicht, die die Teilnahme riskant machen könnten (z. B. Herz-/Kreislaufprobleme, Asthma, Verletzungen, Operationen, Medikamente),\n\nin ausreichender körperlicher Verfassung für Kampfkunst/Kampfsport ist,\n\nselbstständig für angemessene Sportkleidung, Schutzausrüstung und gesundheitliche Vorsorge sorgt.\n\nDie Teilnahme setzt voraus, dass der Teilnehmer sein Training auf eigene Verantwortung gestaltet und auf Warnsignale seines Körpers achtet.\nIm Zweifel ist die Teilnahme zu unterlassen und medizinischer Rat einzuholen.\n\n3. Risiken bei Kampfkunst, Kampfsport & sportlichen Aktivitäten\n\nKampfkunst, Kampfsport und sportliche Bewegungsformen sind mit natürlichen Verletzungsrisiken verbunden, einschließlich, aber nicht beschränkt auf:\n\nPrellungen, Zerrungen, Verstauchungen\n\nVerletzungen der Bänder, Muskeln und Gelenke\n\nKnochenbrüche\n\nKopfverletzungen, Bewusstlosigkeit, Gehirnerschütterungen\n\nAtemnot, Kreislaufprobleme\n\nVerletzungen durch Dritte oder Trainingspartner\n\nSchäden an persönlichem Eigentum\n\nJeder Teilnehmer erklärt ausdrücklich, dass er sich dieser Risiken bewusst ist und sie eigenverantwortlich in Kauf nimmt.\n\n4. Haftung der TDA Int’l\n\nDie Tiger & Dragon Association – International haftet nur im Rahmen der gesetzlichen Bestimmungen und ausschließlich bei:\n\nvorsätzlichem oder grob fahrlässigem Verhalten\n\nVerletzung von Leben, Körper oder Gesundheit, die auf fahrlässiger oder vorsätzlicher Pflichtverletzung beruhen\n\nzwingenden gesetzlichen Haftungsvorschriften (z. B. Produkthaftungsgesetz)\n\nIn allen anderen Fällen ist eine Haftung ausgeschlossen, insbesondere für:\n\neinfache Fahrlässigkeit\n\nVerletzungen, die durch sporttypische Risiken entstehen\n\nHandlungen Dritter (Teilnehmer, Zuschauer, Vereine, Trainer, Schiedsrichter)\n\nSchäden durch fehlende oder mangelhafte Angabe gesundheitlicher Einschränkungen\n\nselbstverschuldete Unfälle\n\nVerlust oder Beschädigung von Wertgegenständen, Kleidung oder Ausrüstung\n\nSchäden aufgrund höherer Gewalt (z. B. Wetter, Stromausfälle, technische Störungen)\n\n5. Haftungsausschluss für Turniere & Wettkämpfe\n\nBei Turnieren und Wettkämpfen bestätigt jeder Teilnehmer bzw. dessen Erziehungsberechtigter:\n\nDie Teilnahme erfolgt freiwillig und auf eigenes Risiko.\n\nDie Regeln, Sicherheitsvorschriften und Anweisungen der Offiziellen werden beachtet.\n\nDer Veranstalter übernimmt keine Haftung für Schäden, die durch Gegner, internes oder externes Fehlverhalten, Regelverstöße oder unvorhersehbare Kampfverläufe entstehen.\n\nDer Teilnehmer trägt selbst die Verantwortung für die vorgeschriebene Schutzausrüstung.\n\nEine gültige Krankenversicherung ist Voraussetzung.\n\nDie TDA Int’l haftet nicht für Unfälle oder Verletzungen, die trotz eines regelkonformen Ablaufs auftreten.\n\n6. Haftungsausschluss für Seminare, Workshops & Training\n\nBei Trainings, Seminaren, Camps und Lehrgängen gilt:\n\nÜbungen können physische und psychische Belastungen mit sich bringen.\n\nJeder hat eigenverantwortlich zu prüfen, ob er die Übung sicher ausführen kann.\n\nDer Trainer stellt lediglich Anleitungen bereit – eine fehlerfreie Ausführung kann nicht garantiert werden.\n\nDer Teilnehmer trägt die Verantwortung, auf eigene Grenzen zu achten.\n\nFür Schäden durch unsachgemäße Selbstüberschätzung wird keine Haftung übernommen.\n\n7. Minderjährige Teilnehmer\n\nErziehungsberechtigte erkennen an:\n\ndass sie die Aufsichtspflicht gegenüber ihren Kindern selbst tragen, soweit diese nicht durch einen Trainer oder Betreuer übernommen wird,\n\ndass sie für Schäden haften, die ihre Kinder anderen zufügen,\n\ndass sie Risiken des Kampfsports kennen und akzeptieren,\n\ndass sie gesundheitliche Einschränkungen ihres Kindes dem Veranstalter mitteilen.\n\n8. Haftung für Ausrüstung & Eigentum\n\nDie TDA Int’l übernimmt keine Verantwortung für:\n\nVerlust oder Diebstahl von Kleidung, Equipment oder Wertgegenständen\n\nBeschädigungen durch Fahrlässigkeit anderer Teilnehmer\n\nselbst mitgebrachte Trainingsgeräte oder Hilfsmittel\n\nJeder ist selbst für seine Gegenstände verantwortlich.\n\n9. Foto-, Video- und Medienaufnahmen\n\nBei allen Veranstaltungen kann die TDA Int’l Foto- und Videoaufnahmen erstellen bzw. erstellen lassen.\n\nMit der Teilnahme erklärt jeder Teilnehmer bzw. Erziehungsberechtigte:\n\nEr ist einverstanden, dass Aufnahmen im Rahmen der Vereins-/Verbandsarbeit veröffentlicht werden dürfen (Website, Social Media, Turnierberichte, Printmedien usw.).\n\nEin Widerruf ist möglich, jedoch nicht rückwirkend für bereits veröffentlichte Materialien.\n\nBei Portrait- oder individuellen Aufnahmen kann eine gesonderte Einwilligung erforderlich sein.\n\n10. Verhalten, Regelverstöße & Ausschluss von der Teilnahme\n\nDie TDA Int’l behält sich das Recht vor, Teilnehmer ohne Anspruch auf Rückerstattung auszuschließen, wenn:\n\nSicherheitsanweisungen missachtet werden,\n\ngesundheitliche Risiken verschwiegen wurden,\n\naggressives, gefährliches oder respektloses Verhalten gezeigt wird,\n\neine Gefährdung anderer Personen besteht.\n\n11. Höhere Gewalt & Veranstaltungsänderungen\n\nFür Ausfälle, Änderungen oder Abbruch einer Veranstaltung aufgrund von Ereignissen außerhalb unserer Kontrolle (z. B. Wetter, Krankheit des Trainers, technische Störungen, Pandemien) wird keine Haftung übernommen.\n\nBereits gezahlte Gebühren können nach Ermessen des Veranstalters erstattet, gutgeschrieben oder als Teilnahmeberechtigung für einen späteren Termin anerkannt werden.\n\n12. Versicherungen\n\nJeder Teilnehmer ist selbst dafür verantwortlich, über ausreichende Kranken-, Unfall- und Haftpflichtversicherung zu verfügen.\n\nDer Veranstalter übernimmt nicht die Kosten für Verletzungen oder Krankenhausaufenthalte, sofern dies nicht gesetzlich vorgeschrieben ist.\n\n13. Salvatorische Klausel\n\nSollten einzelne Bestimmungen dieses Haftungsausschlusses unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.\nAn die Stelle der unwirksamen Klausel tritt eine Regelung, die dem wirtschaftlichen Zweck am nächsten kommt.\n\n14. Anerkennung des Haftungsausschlusses\n\nMit der Teilnahme an jeglichen Aktivitäten, Veranstaltungen oder Programmen der Tiger & Dragon Association – International erkennt der Teilnehmer bzw. dessen Erziehungsberechtigter diesen Haftungsausschluss vollständig und verbindlich an.',NULL,NULL,NULL,0,'2026-01-05 16:31:20','2025-09-02 08:34:23','active','free','2026-01-08 20:21:43',NULL,'2026-01-08 20:21:43',NULL),(3,'Kampfsportschule Schreiner','dojo-3','Stephanie Schreiner','','','','Vilsbbiburg','015752461776','','info@tda-vib.de','https://www.tda-vib.de','','',NULL,0,'Deutschland','','','','',NULL,NULL,'',NULL,0,0,0,NULL,'Verein','','','','','','','','',NULL,NULL,NULL,'','','','','','','',0,'',NULL,NULL,'',NULL,'','Allgemeine Geschäftsbedingungen (AGB)\n\nder Kampfsportschule Schreiner\nOhmstraße 14, 84137 Vilsbiburg\n(im Folgenden Schule, Anbieter)\n\nStand: 31.10.2025\n\n1. Geltung, Vertragsparteien, Änderungen\n\n1.1. Diese AGB gelten für alle Verträge, Leistungen, Kurse und Mitgliedschaften, die zwischen der Kampfsportschule Schreiner (im Folgenden Schule) und den Teilnehmenden bzw. Mitgliedern (im Folgenden Mitglied, Teilnehmer, Kunde) geschlossen werden.\n\n1.2. Abweichende Bedingungen des Kunden werden ausdrücklich zurückgewiesen, es sei denn, die Schule hat ihnen schriftlich ausdrücklich zugestimmt.\n\n1.3. Einzelverträge und schriftliche Vereinbarungen haben Vorrang vor diesen AGB.\n\n1.4. Änderungen oder Ergänzungen dieser AGB bedürfen zur Wirksamkeit der Schriftform, sofern nicht ausdrücklich etwas anderes geregelt ist.\n\n1.5. Die Schule behält sich vor, einzelne Regelungen dieser AGB mit Wirkung für die Zukunft zu ändern. Änderungen werden dem Mitglied mindestens vier Wochen vor Inkrafttreten in Textform (z.?B. E?Mail, Aushang, Post) bekannt gegeben. Widerspricht das Mitglied der Änderung nicht schriftlich bis zum Inkrafttreten, gelten die Änderungen als angenommen. Auf die Bedeutung der Widerspruchsfrist wird die Schule den Teilnehmenden bei Bekanntgabe besonders hinweisen.\n\n2. Vertragsabschluss, Teilnahmevoraussetzungen\n\n2.1. Der Vertrag über die Teilnahme an Kursen, das Training oder eine Mitgliedschaft kommt zustande durch Unterzeichnung eines schriftlichen Vertrags oder eines Anmeldeformulars oder  soweit angeboten  durch Elektronische Anmeldung mit Bestätigung durch die Schule.\n\n2.2. Minderjährige (unter 18 Jahren) dürfen einen Vertrag nur mit Einwilligung der gesetzlichen Vertreter schließen. Diese müssen durch Unterschrift zustimmen.\n\n2.3. Vor Beginn der Teilnahme ist ein Gesundheitsfragebogen/Erklärung zur Sporttauglichkeit durch den Teilnehmenden oder  bei Minderjährigen  durch die gesetzlichen Vertreter auszufüllen. Der Teilnehmende bestätigt damit, dass keine medizinischen Einwände gegen die Teilnahme bestehen, oder er legt ein ärztliches Attest vor, wenn gesundheitliche Risiken bestehen.\n\n2.4. Der Anbieter kann die Teilnahme verweigern, wenn der Gesundheitszustand des Teilnehmenden Bedenken aufwirft, insbesondere wenn eine Gefährdung für sich oder andere bestehen könnte.\n\n3. Leistungsumfang und Nutzung\n\n3.1. Gegenstand der Leistungen sind Trainings-, Kurs- und Unterrichtsangebote im Bereich Kampfsport, Selbstverteidigung, Fitness-Training etc., sowie gegebenenfalls Zusatzleistungen (z.?B. Personal Training, Seminare, Prüfungen).\n\n3.2. Der konkrete Leistungsumfang ergibt sich aus dem Vertrag bzw. der Leistungsbeschreibung im Angebot der Schule.\n\n3.3. Die Nutzung der Räumlichkeiten, der Ausstattung und Hilfsmittel erfolgt nur zu dem im Vertrag festgelegten Umfang und nach Maßgabe der Hausordnung.\n\n3.4. Eine Übertragung der Mitgliedschaft oder der Teilnahmeberechtigung auf Dritte ist ausgeschlossen, sofern nichts anderes ausdrücklich vereinbart ist.\n\n4. Pflichten der Mitglieder / Teilnehmer\n\n4.1. Die Mitglieder verpflichten sich insbesondere:\n\ndie Anweisungen der Trainer, Übungsleiter oder des Personals zu befolgen;\n\nsich an die Hausordnung sowie Sicherheits- und Hygienevorschriften zu halten;\n\nkeine Handlungen vorzunehmen, die Gefahr für Leib, Leben oder Eigentum anderer darstellen;\n\nvor oder während der Teilnahme auftretende Unwohlsein, gesundheitliche Beschwerden oder Verletzungen unverzüglich dem Trainer oder der Schule anzuzeigen;\n\neigenes Trainingsmaterial (z.?B. geeignete Kleidung, Schutzausrüstung, Getränke) mitzubringen, sofern nicht durch die Schule gestellt;\n\nSauberkeit, Ordnung und Rücksicht auf andere Teilnehmende zu wahren.\n\n4.2. Bei groben oder wiederholten Pflichtverletzungen kann die Schule den Vertrag außerordentlich kündigen (siehe Ziffer 8).\n\n4.3. Das Mitglied ist verpflichtet, Änderungen seiner Kontakt- oder Bankdaten unverzüglich mitzuteilen.\n\n5. Beiträge, Preise, Zahlung\n\n5.1. Die Höhe der Beiträge, Kursgebühren und Zusatzkosten ergibt sich aus der aktuellen Preisliste bzw. dem Vertrag.\n\n5.2. Die Beiträge sind regelmäßig im Voraus  meist monatlich, vierteljährlich oder jährlich  zu entrichten. Der genaue Fälligkeitstermin ergibt sich aus dem Vertrag.\n\n5.3. Bei Zahlungsverzug gelten folgende Regelungen:\n\nNach Mahnung wird eine Mahngebühr (fester Betrag oder Prozentsatz) erhoben;\n\nBei Nichtzahlung kann die Schule den Zutritt verweigern, bis der Rückstand beglichen ist;\n\nNach einer bestimmten Frist (z.?B. 23 Monate) kann die Schule den Vertrag kündigen und die Rückstände und den restlichen ausstehenden Betrag bis zur Beendigung des Vertrages einfordern.\n\n5.4. Bei Verträgen über einen bestimmten Zeitraum (z.?B. Jahresvertrag) wird bei vorzeitiger Beendigung durch das Mitglied keine anteilige Rückerstattung geleistet, sofern nicht ausdrücklich anders vereinbart oder gesetzlich vorgeschrieben.\n\n5.5. Sonderleistungen oder Zusatzangebote (z.?B. Privatstunden, Prüfungsgebühren) werden gesondert berechnet und sind ebenfalls fristgerecht zu zahlen.\n\n5.6. Die Schule behält sich vor, Beiträge und Gebühren anzupassen (z.?B. wegen gestiegener Kosten). Eine Erhöhung wird dem Mitglied mindestens vier Wochen vorher in Textform mitgeteilt. Widerspricht das Mitglied nicht fristgerecht schriftlich, gilt die Erhöhung als genehmigt. Ein Sonderkündigungsrecht wird nicht gewährleistet.\n\n6. Vertragsdauer und Kündigung\n\n6.1. Vertragsdauer und Kündigungsfristen ergeben sich aus dem jeweiligen Vertrag (z.?B. Monat auf Monatsbasis, Mindestvertragsdauer, Laufzeit, Verlängerung).\n\n6.2. Die Kündigung bedarf der Schriftform (Brief, E-Mail,  sofern im Vertrag zugelassen  elektronisch), sofern nicht anders vereinbart.\n\n6.3. Bei Verträgen mit Mindestlaufzeit ist eine ordentliche Kündigung frühestens zum Ende der Mindestlaufzeit möglich. Danach gilt meist eine Kündigungsfrist (z.?B. 13 Monate).\n\n6.4. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor:\n\nwenn eine Partei ihre vertraglichen Pflichten schwerwiegend verletzt;\n\nbei erheblicher Gesundheitsgefährdung des Mitglieds;\n\nbei Insolvenz oder Einstellung des Geschäftsbetriebs der Schule.\n\n7. Unterbrechung / Ruhen des Vertrages\n\n7.1. In bestimmten Ausnahmefällen (z.?B. längere Krankheit, Schwangerschaft, Auslandsaufenthalt) kann der Vertrag auf schriftlichen Antrag und Nachweis befristet ruhen. Die Mindestdauer, Höchstdauer und Bedingungen für einen solchen Freeze sind im Vertrag oder der Preisliste festzulegen.\n\n7.2. Für Ruhtage ist in der Regel ein Entgelt bzw. Verwaltungskosten oder ein reduzierter Beitrag zu erheben.\n\n7.3. Während der Ruhezeiten besteht kein Anspruch auf Nutzung der Leistungen, es sei denn, es wird ausdrücklich etwas Anderes vereinbart.\n\n8. Haftung, Versicherung, Ausschluss\n\n8.1. Die Schule haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung oder auf Vorsatz/Grobe Fahrlässigkeit der Schule oder ihrer Erfüllungsgehilfen beruhen.\n\n8.2. Für sonstige Schäden haftet die Schule nur bei Vorsatz oder grober Fahrlässigkeit, es sei denn, eine Pflichtverletzung betrifft eine wesentliche Vertragspflicht (Kardinalpflicht). In diesem Fall ist die Haftung auf den typischerweise vorhersehbaren Schaden begrenzt.\n\n8.3. Eine Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit gesetzlich zulässig.\n\n8.4. Insbesondere haftet die Schule nicht für:\n\nVerletzungen oder Schäden, die durch Zuwiderhandlung gegen Anweisungen, Regeln oder Sicherheitsvorgaben oder durch den Körperkontakt im Kampftraining entstehen;\n\nSchäden, die durch eigenes fahrlässiges Verhalten des Mitglieds verursacht werden;\n\nSchäden an mitgebrachten Gegenständen oder Wertgegenständen (z.?B. Kleidung, Schmuck, elektronische Geräte), sofern nicht grobe Fahrlässigkeit oder Vorsatz vorliegt.\n\n8.5. Der Teilnehmende ist verpflichtet, eigene Unfall- und Haftpflichtversicherung zu haben, soweit möglich, und ggf. Schädenmeldungspflichten zu erfüllen.\n\n9. Aussetzung und Ersatztraining\n\n9.1. Die Schule kann aufgrund von Betriebsstörungen, behördlichen Anordnungen, außergewöhnlichen Ereignissen (z.?B. Unwetter, Pandemien), Krankheit von Trainern oder aus anderen wichtigen Gründen den Trainingsbetrieb ganz oder teilweise unterbrechen.\n\n9.2. In solchen Fällen kann die Schule nach Möglichkeit Ersatztermine oder alternative Angebote anbieten oder eine anteilige Gutschrift bzw. Beitragsminderung gewähren.\n\n9.3. Der Anspruch auf Ersatzleistung erlischt, wenn das Mitglied die Ersatzangebote nicht innerhalb einer angemessenen Frist in Anspruch nimmt, ohne ein berechtigtes Hindernis geltend zu machen.\n\n10. Widerrufsrecht für Verbraucher\n\n10.1. Sofern ein Vertrag online oder außerhalb von Geschäftsräumen mit einem Verbraucher geschlossen wird, steht dem Verbraucher ein gesetzliches Widerrufsrecht zu (vgl. §§ 312g, 355 BGB).\n\n10.2. Die Widerrufsbelehrung und die Bedingungen zum Widerruf sind im Vertrag bzw. in der Auftragsbestätigung getrennt darzustellen.\n\n10.3. Das Widerrufsrecht entfällt vollständig bei Verträgen zur Erbringung von Dienstleistungen (z.?B. Trainingsleistungen, Mitgliedschaften, Kurse), wenn der Vertrag für eine bestimmte Zeit abgeschlossen ist und die Ausführung der Dienstleistung mit Zustimmung des Verbrauchers beginnt und der Verbraucher seine Kenntnis bestätigt, dass er mit Beginn der Vertragserfüllung sein Widerrufsrecht verliert.\n\n11. Datenschutz\n\n11.1. Die Schule erhebt, verarbeitet und nutzt personenbezogene Daten der Mitglieder nur, soweit dies zur Durchführung des Vertrags nötig ist, gesetzlich erlaubt oder vom Mitglied ausdrücklich genehmigt ist.\n\n11.2. Nähere Einzelheiten zur Datenverarbeitung, Zweckbindung, Speicherung und Rechte der Betroffenen ergeben sich aus der gesonderten Datenschutzinformation / Datenschutzrichtlinie der Schule.\n\n12. Schlussbestimmungen, Salvatorische Klausel, Gerichtsstand, anwendbares Recht\n\n12.1. Sollten einzelne Bestimmungen dieser AGB unwirksam oder undurchführbar sein oder werden, bleibt die Gültigkeit der übrigen Bestimmungen unberührt. Die Parteien verpflichten sich, die unwirksame Regelung durch eine solche wirksame zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen möglichst nahekommt.\n\n12.2. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.\n\n12.3. Soweit gesetzlich zulässig und der Teilnehmende Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist, ist ausschließlicher Gerichtsstand der Sitz der Schule (Vilsbiburg). Andernfalls gelten die gesetzlichen Gerichtsstände.\n\n12.4. Änderungen oder Ergänzungen des Vertrags, einschließlich dieser Klausel, bedürfen der Schriftform.\n',NULL,NULL,'Impressum\n\nAngaben gemäß § 5 TMG / § 55 RStV\n\nKampfsportschule Schreiner\nInhaber / Verantwortlicher: Stephanie Schreiner\nOhmstr. 14\n84137 Vilsbiburg\nDeutschland\n\nKontakt:\nTelefon: 01575 2461776\nE-Mail: info@tda-vib.de\n\nWebseite: www.tda-vib.de\n\nVertretungsberechtigt\n\nStephanie Schreiner\n(Inhaber, Verbandrepräsentant)\n\nUmsatzsteuer / Steuernummer\n\n\n\nInhaltlich Verantwortlicher gemäß § 55 Abs. 2 RStV\n\nStephanie Schreiner\nOhmstr. 14\n84137 Vilsbiburg\n\nHaftung für Inhalte\n\nAls Dienstanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.\nNach §§ 8?10 TMG sind wir jedoch nicht verpflichtet,\n\nübermittelte oder gespeicherte fremde Informationen zu überwachen oder\n\nnach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.\n\nVerpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.\nEine Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich.\nBei Bekanntwerden entsprechender Rechtsverletzungen entfernen wir diese Inhalte umgehend.\n\nHaftung für Links\n\nUnser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.\nDeshalb können wir für diese fremden Inhalte keine Gewähr übernehmen.\n\nFür die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.\nBei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links sofort.\n\nUrheberrecht\n\nDie auf dieser Website veröffentlichten Inhalte, Bilder, Texte, Grafiken, Logos und Designs unterliegen dem deutschen Urheberrecht.\nVervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Rechteinhabers.\n\nDownloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.\n\nMarken- und Schutzrechte\n\n?Kampfsportschule Schreiner? sowie sämtliche Logos, Abzeichen und Titel können geschützte Marken oder eingetragene Kennzeichen sein.\nJede unbefugte Nutzung ist untersagt.\n\nOnline-Streitbeilegung\n\nDie Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:\nhttps://ec.europa.eu/consumers/odr\n\nWir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.\n\nGender-Hinweis\n\nAus Gründen der Lesbarkeit wird in Texten auf dieser Seite überwiegend die männliche Form gewählt.\nAlle personenbezogenen Bezeichnungen gelten gleichermaßen für alle Geschlechter.\n\n',3,12,14,NULL,1,0,'','','','','','','','',0,'','Karate','','',0,0,0,45.00,25.00,NULL,NULL,NULL,NULL,5.00,10.00,'',NULL,'#DAA520','de','Europe/Berlin','EUR',NULL,'',500,20,50,1,1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-19 06:34:23','2026-01-08 19:21:33',NULL,'1.0','manual_sepa',NULL,NULL,NULL,NULL,NULL,'1. Verantwortlicher\n\nKampfsportschule Schreiner  International\nInhaber / Verantwortlicher: Stephanie Schreiner\nAnschrift: Ohmstr. 14, 84137 Vilsbiburg, Deutschland\nTelefon: +49 (0)1575 2461776\nE-Mail: info@tda-vib.de\n\nWebseite: www.tda-vib.de\n\n(im Folgenden wir, uns oder TDA Intl)\n\n2. Geltungsbereich\n\nDiese Datenschutzerklärung informiert dich darüber, welche personenbezogenen Daten wir erheben, wenn du\n\nunsere Webseite www.tda-vib.de\n besuchst,\n\ndich oder deine Schule/deinen Verein zu unseren Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events oder anderen Events anmeldest,\n\nmit uns per E-Mail, Telefon, Kontaktformular oder auf andere Weise in Kontakt trittst,\n\nMitglied im Verband wirst oder als Partner/Instructor mit uns zusammenarbeitest.\n\nSie gilt insbesondere im Rahmen der Datenschutz-Grundverordnung (DSGVO) und des Bundesdatenschutzgesetzes (BDSG).\n\n3. Begriffe\n\nPersonenbezogene Daten sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen (z. B. Name, Adresse, E-Mail, IP-Adresse).\n\nVerarbeitung ist jeder Vorgang im Zusammenhang mit personenbezogenen Daten (z. B. Erheben, Speichern, Übermitteln, Löschen).\n\n4. Rechtsgrundlagen der Verarbeitung\n\nWir verarbeiten personenbezogene Daten auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO  Einwilligung\n\nArt. 6 Abs. 1 lit. b DSGVO  Vertragserfüllung oder vorvertragliche Maßnahmen (z. B. Turnieranmeldung, Mitgliedsantrag)\n\nArt. 6 Abs. 1 lit. c DSGVO  rechtliche Verpflichtung (z. B. Aufbewahrungspflichten)\n\nArt. 6 Abs. 1 lit. f DSGVO  berechtigtes Interesse\n(z. B. sichere Bereitstellung der Webseite, Organisation von Veranstaltungen, Außendarstellung, Verbandsverwaltung)\n\n5. Bereitstellung der Webseite und Server-Logfiles\n5.1 Art der Daten\n\nBeim Besuch unserer Webseite werden durch den von dir verwendeten Browser automatisch Informationen an unseren Server übermittelt und in Server-Logfiles gespeichert. Dies sind u. a.:\n\nIP-Adresse deines Endgeräts\n\nDatum und Uhrzeit des Zugriffs\n\naufgerufene Seite/Datei\n\nReferrer-URL (zuvor besuchte Seite, falls übermittelt)\n\nverwendeter Browser und Betriebssystem\n\nggf. Name deines Access-Providers\n\nDiese Daten werden nicht mit anderen Datenquellen zusammengeführt und nicht zur Identifizierung einzelner Personen verwendet.\n\n5.2 Zweck\n\nSicherstellung eines reibungslosen Verbindungsaufbaus der Webseite\n\nGewährleistung einer komfortablen Nutzung unserer Webseite\n\nAuswertung der Systemsicherheit und -stabilität\n\ntechnische Administration\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und stabilen Betrieb der Webseite).\n\n5.3 Speicherdauer\n\nServer-Logfiles werden in der Regel für 730 Tage gespeichert und anschließend automatisch gelöscht, sofern keine längere Aufbewahrung zu Beweiszwecken im Einzelfall erforderlich ist (z. B. bei Sicherheitsvorfällen).\n\n6. Cookies und Einwilligungs-Management\n6.1 Cookies\n\nUnsere Webseite kann sogenannte Cookies verwenden. Das sind kleine Textdateien, die auf deinem Endgerät gespeichert werden.\n\nArten von Cookies:\n\nTechnisch notwendige Cookies\nz. B. zur Sprachauswahl, Sitzungserkennung, Warenkorb-/Formularfunktionen, Login-Bereich\n? Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO oder § 25 Abs. 2 TTDSG\n\nOptionale Cookies (z. B. für Statistik/Analyse oder Marketing)  falls eingesetzt\n? Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 25 Abs. 1 TTDSG (nur mit Einwilligung)\n\n6.2 Cookie-Einwilligung\n\nSofern wir ein Cookie-Banner / Consent-Tool einsetzen, kannst du dort entscheiden, welchen Kategorien von Cookies du zustimmst. Deine Auswahl kannst du jederzeit über die entsprechenden Einstellungen im Consent-Tool oder in deinem Browser ändern.\n\n7. Kontaktaufnahme (E-Mail, Telefon, Kontaktformular)\n\nWenn du uns kontaktierst, z. B. per E-Mail, Telefon oder Kontaktformular, verarbeiten wir die von dir mitgeteilten Daten:\n\nName\n\nKontaktdaten (E-Mail, Telefonnummer)\n\nBetreff und Inhalt deiner Nachricht\n\nggf. Vereins-/Dojo-Name, Land, Funktion (Instructor, Schüler, Funktionär usw.)\n\nZweck der Verarbeitung ist die Bearbeitung deines Anliegens, Rückfragen und Kommunikation.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO, sofern deine Anfrage mit der Durchführung eines Vertrages oder vorvertraglicher Maßnahmen zusammenhängt (z. B. Turnieranmeldung, Mitgliedsantrag).\n\nArt. 6 Abs. 1 lit. f DSGVO, bei allgemeinen Anfragen (berechtigtes Interesse an effektiver Kommunikation).\n\nSpeicherdauer:\nWir speichern deine Anfrage, solange es zur Bearbeitung erforderlich ist. Danach werden die Daten regelmäßig gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.\n\n8. Mitgliedschaft, Verband, Schulen & Partner\n\nWenn du Mitglied bei TDA Intl wirst oder als Dojo/Schule/Instructor mit uns zusammenarbeitest, verarbeiten wir  je nach Rolle  insbesondere:\n\nStammdaten: Name, Adresse, Geburtsdatum, Kontaktdaten (Telefon, E-Mail)\n\nVerbandsbezogene Daten: Dojo-/Vereinsname, Stilrichtung(en), Position im Verband, Mitgliedsstatus, Funktion (Instructor, Schulleiter, Funktionär)\n\nVertrags- und Abrechnungsdaten: Bankverbindung, Zahlungsinformationen (z. B. Beitragszahlungen), ggf. Rechnungen\n\nKommunikationsdaten: Schriftwechsel im Zusammenhang mit der Mitgliedschaft/Kooperation\n\nZweck:\n\nVerwaltung von Mitgliedern, Schulen und Partnern\n\nDurchführung des Mitgliedschafts- oder Kooperationsverhältnisses\n\nOrganisation von Veranstaltungen, Ernennungen, Lizenzen, Instructor-Tätigkeiten\n\nAbrechnung und Beitragseinzug\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und ggf. Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten, z. B. steuerliche Aufbewahrung).\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Mitgliedschaft/Kooperation und darüber hinaus für gesetzliche Aufbewahrungsfristen (in der Regel 610 Jahre) gespeichert. Daten, die nicht mehr benötigt werden, werden gelöscht oder anonymisiert.\n\n9. Online-Anmeldung zu Turnieren, Seminaren, Hall of Fame & Events\n\nZur Anmeldung zu unseren Turnieren, Hall-of-Fame-Veranstaltungen, Seminaren, Charity-Events und weiteren Events erheben wir je nach Event folgende Daten von Teilnehmern, Trainern, Vereinen/Schulen:\n\nPersonendaten der Teilnehmer*innen:\nName, Vorname, Geburtsdatum, Geschlecht, Nationalität\n\nSportbezogene Daten:\nStilrichtung, Graduierung/Gürtel, Gewichtsklasse, Startkategorien, Wettkampfklassen, ggf. Leistungsstand\n\nKontaktdaten:\nAnschrift, E-Mail, Telefonnummer des Teilnehmers oder Vereins/Trainers\n\nVereins-/Dojo-Daten:\nName, Anschrift, Ansprechpartner, Verband, Land\n\nAbrechnungsdaten:\nTeilnahmegebühren, Zahlungsinformationen (z. B. Vermerk über Zahlungseingang  konkrete Zahlungsdaten beim Zahlungsdienstleister)\n\nZwecke der Verarbeitung:\n\nOrganisation und Durchführung der Veranstaltung\n\nErstellung von Startlisten, Pools, Kampffeldern und Zeitplänen\n\nErgebniserfassung, Ranglisten, Siegerehrungen, Urkunden\n\nKommunikation mit Teilnehmern, Vereinen und Offiziellen\n\nAbrechnung und ggf. Nachweis gegenüber Sponsoren, Partnern oder Verbänden\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung  Durchführung der Veranstaltung)\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer professionellen Organisation und sportlichen Auswertung)\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Veranstaltungsorganisation sowie für die Dokumentation von Ergebnissen (z. B. Ranglisten, Jahreswertung, Hall of Fame) gespeichert. Soweit möglich, werden Langzeitauswertungen in anonymisierter oder pseudonymisierter Form geführt. Rechts- und steuerrelevante Daten bewahren wir gemäß der gesetzlichen Fristen auf.\n\n10. Hall of Fame, Berichterstattung, Fotos & Videos\n\nIm Rahmen von Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events und sonstigen Veranstaltungen erstellen wir ggf. Fotos und Videos, u. a. für:\n\nBerichte zu Veranstaltungen auf unserer Webseite, in Social Media, in Newslettern oder Printmedien\n\nDokumentation sportlicher Leistungen und Ehrungen\n\nArchivzwecke und Hall-of-Fame-Einträge\n\nDabei können Teilnehmer, Trainer, Offizielle, Gäste und Ehrengäste erkennbar sein.\n\nRechtsgrundlagen:\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Berichterstattung, Außendarstellung, Dokumentation des Verbandslebens)\n\nsoweit erforderlich: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. bei Portraitaufnahmen, Nahaufnahmen oder bestimmten Veröffentlichungen)\n\nWenn du nicht fotografiert werden möchtest oder mit einer Veröffentlichung nicht einverstanden bist, kannst du uns das möglichst frühzeitig mitteilen (z. B. an der Anmeldung, beim Fotografen oder per E-Mail). Bereits veröffentlichte Inhalte prüfen wir im Einzelfall und entfernen sie, sofern keine überwiegenden berechtigten Interessen entgegenstehen.\n\n11. Newsletter & Informationsmails (falls eingesetzt)\n\nSofern wir einen Newsletter oder regelmäßige Informationsmails anbieten, gilt:\n\nFür den Versand benötigen wir deine E-Mail-Adresse und ggf. deinen Namen.\n\nDie Anmeldung erfolgt in der Regel über ein Double-Opt-In-Verfahren: Erst nach Bestätigung deiner E-Mail-Adresse erhältst du den Newsletter.\n\nDu kannst dich jederzeit vom Newsletter abmelden, z. B. über einen Abmeldelink in jeder E-Mail oder durch Nachricht an uns.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung)\n\nSpeicherdauer:\nWir speichern deine Daten, bis du dich vom Newsletter abmeldest oder deine Einwilligung widerrufst.\n\n12. Nutzerkonten / Login-Bereich (falls vorhanden)\n\nWenn wir einen geschützten Login-Bereich für Vereine/Instruktoren/Teilnehmer anbieten, verarbeiten wir:\n\nZugangsdaten (Benutzername, Passwort  Passwort nur in verschlüsselter Form)\n\nRegistrierungsdaten (Name, E-Mail, Verein, Rolle im System)\n\nNutzungsdaten (z. B. erfasste Teilnehmer, Meldungen, Bearbeitungen im System)\n\nZweck: Bereitstellung des geschützten Bereichs, Verwaltung von Meldungen, Administration von Turnieren und Verbandsdaten.\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzervertrag für den Login-Bereich) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherer Systemverwaltung).\n\n13. Zahlungsabwicklung (falls über Zahlungsdienstleister)\n\nSofern Teilnahmegebühren, Mitgliedsbeiträge oder andere Leistungen über Zahlungsdienstleister oder Kreditinstitute abgewickelt werden, werden die hierfür erforderlichen Daten (z. B. Name, Betrag, IBAN/BIC oder andere Zahlungsinformationen) an das jeweilige Unternehmen übermittelt.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung  Zahlungsabwicklung)\n\nArt. 6 Abs. 1 lit. c DSGVO (gesetzliche Aufbewahrungspflichten)\n\nDie detaillierte Verarbeitung erfolgt beim jeweiligen Zahlungsdienstleister. Bitte beachte ergänzend deren Datenschutzhinweise.\n\n14. Webanalyse & Tracking (falls eingesetzt)\n\nSofern wir Webanalyse-Dienste (z. B. zur statistischen Auswertung der Nutzung unserer Webseite) verwenden, geschieht dies nur auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung, falls Cookies/Tracking erforderlich) oder\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer bedarfsgerechten Gestaltung und Optimierung der Webseite), soweit dies ohne Einwilligung zulässig ist.\n\nDie konkrete Ausgestaltung (Dienstleister, Umfang der Datenverarbeitung, Speicherdauer, ggf. Drittlandtransfer) wird in einem separaten Abschnitt oder im Cookie-Banner erläutert, sobald diese Dienste eingesetzt werden.\n\n15. Empfänger der Daten / Auftragsverarbeiter\n\nWir geben personenbezogene Daten nur an Dritte weiter, soweit dies\n\nzur Vertragserfüllung notwendig ist (z. B. Dienstleister für IT, Hosting, Zahlungsabwicklung, Urkundendruck, Versand),\n\nwir dazu gesetzlich verpflichtet sind (z. B. Behörden, Finanzamt),\n\nes zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist oder\n\ndu eingewilligt hast.\n\nMit Dienstleistern, die in unserem Auftrag personenbezogene Daten verarbeiten, schließen wir Auftragsverarbeitungsverträge gemäß Art. 28 DSGVO.\n\n16. Datenübermittlung in Drittländer\n\nDa wir ein internationaler Verband sind und Mitglieder, Schulen und Partner weltweit vertreten, kann es in Einzelfällen zu einer Übermittlung von personenbezogenen Daten in Länder außerhalb der EU/des EWR kommen (z. B. zur Koordination internationaler Events oder zur Kommunikation mit Landesvertretungen).\n\nIn solchen Fällen achten wir besonders darauf, dass\n\nentweder ein Angemessenheitsbeschluss der EU-Kommission vorliegt oder\n\ngeeignete Garantien nach Art. 46 DSGVO bestehen (z. B. EU-Standardvertragsklauseln) oder\n\neine Einwilligung der betroffenen Person vorliegt bzw. eine andere gesetzliche Grundlage besteht.\n\n17. Speicherdauer und Löschung der Daten\n\nWir verarbeiten und speichern personenbezogene Daten nur für den Zeitraum, der zur Zweck­erfüllung erforderlich ist oder sofern dies in Gesetzen, Verordnungen oder anderen Vorschriften vorgesehen ist.\n\nKriterien für die Speicherdauer sind u. a.:\n\nDauer der Mitgliedschaft oder Zusammenarbeit\n\ngesetzliche Aufbewahrungspflichten (z. B. handels- und steuerrechtlich meist 610 Jahre)\n\nBedeutung für die Dokumentation sportlicher Leistungen (z. B. Hall-of-Fame-Einträge, historische Ranglisten)\n\nNach Wegfall des Zwecks bzw. Ablauf gesetzlicher Fristen werden die Daten gelöscht oder anonymisiert.\n\n18. Datensicherheit\n\nWir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um deine Daten gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder unbefugten Zugriff zu schützen.\n\nUnsere Webseite verwendet in der Regel SSL-/TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennst du z. B. an https:// und einem Schloss-Symbol im Browser.\n\n19. Deine Rechte als betroffene Person\n\nDir stehen nach der DSGVO insbesondere folgende Rechte zu:\n\nAuskunft (Art. 15 DSGVO)\nDu kannst Auskunft darüber verlangen, ob und welche personenbezogenen Daten wir über dich verarbeiten.\n\nBerichtigung (Art. 16 DSGVO)\nDu kannst die Berichtigung unrichtiger oder Vervollständigung unvollständiger Daten verlangen.\n\nLöschung (Art. 17 DSGVO)\nDu kannst unter bestimmten Voraussetzungen die Löschung deiner Daten verlangen (Recht auf Vergessenwerden).\n\nEinschränkung der Verarbeitung (Art. 18 DSGVO)\nDu kannst in bestimmten Fällen die Einschränkung der Verarbeitung verlangen.\n\nDatenübertragbarkeit (Art. 20 DSGVO)\nDu kannst verlangen, dass wir dir die Daten, die du uns bereitgestellt hast, in einem strukturierten, gängigen und maschinenlesbaren Format übermitteln oder an einen anderen Verantwortlichen übertragen.\n\nWiderspruchsrecht (Art. 21 DSGVO)\nDu hast das Recht, aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit gegen die Verarbeitung deiner personenbezogenen Daten, die wir auf Grundlage von Art. 6 Abs. 1 lit. e oder f DSGVO vornehmen, Widerspruch einzulegen.\nWir verarbeiten die personenbezogenen Daten dann nicht mehr, es sei denn, es liegen zwingende schutzwürdige Gründe vor oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.\n\nWiderruf von Einwilligungen (Art. 7 Abs. 3 DSGVO)\nEine einmal erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.\n\nBeschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO)\nDu hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren, wenn du der Ansicht bist, dass die Verarbeitung der dich betreffenden Daten gegen Datenschutzrecht verstößt.\n\n20. Pflicht zur Bereitstellung von Daten\n\nIn manchen Fällen ist die Bereitstellung personenbezogener Daten erforderlich, z. B. zur:\n\nAnmeldung zu Turnieren, Seminaren oder Veranstaltungen\n\nBearbeitung eines Mitgliedsantrags\n\nErfüllung vertraglicher oder gesetzlicher Pflichten\n\nWenn du die erforderlichen Daten nicht bereitstellst, kann es sein, dass wir die gewünschte Leistung (z. B. Teilnahme an einem Turnier, Mitgliedschaft, Nutzung des Login-Bereichs) nicht erbringen können.\n\n21. Änderungen dieser Datenschutzerklärung\n\nWir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder Änderungen unserer Leistungen (z. B. Einführung neuer Dienste) widerspiegelt.\n\nFür deinen erneuten Besuch gilt dann die jeweils aktuelle Version der Datenschutzerklärung.\n\nStand: 11.12.2025\n','? Dojo-Regeln der Kampfsportschule Schreiner\n1. Respekt ist Grundvoraussetzung\n\nWir begegnen allen Menschen im Dojo mit Respekt ? unabhängig von Herkunft, Alter, Geschlecht, Graduierung oder körperlicher Fähigkeit.\nRespekt beginnt beim Betreten des Dojos und endet erst beim Verlassen.\n\n2. Verbeugung (Rei) als Zeichen der Wertschätzung\n\nBeim Betreten und Verlassen der Matte wird verbeugt.\nDie Verbeugung gilt dem Dojo, dem Weg und den Trainingspartnern.\n\n3. Pünktlichkeit ist Pflicht\n\nDas Training beginnt pünktlich.\nWer zu spät kommt, wartet am Mattenrand auf das Zeichen des Trainers, bevor er das Training betritt.\n\n4. Aufmerksamkeit und Disziplin\n\nWährend des Trainings wird:\n\nnicht geredet, wenn der Trainer erklärt\n\nvollständig zugehört\n\nkonzentriert gearbeitet\n\nstörendes Verhalten vermieden\n\nDer Weg der Kampfkunst beginnt mit Disziplin.\n\n5. Sauberkeit & Ordnung\n\nDie Matte wird nur sauber und mit gewaschenen Füßen betreten.\n\nHände und Füße sind gepflegt, Nägel kurz.\n\nDer Gi / die Trainingskleidung muss sauber, vollständig und ordentlich sein.\n\nDas Dojo wird sauber gehalten ? jeder hilft mit.\n\n6. Kein Schmuck, keine Gefahrenquellen\n\nAus Sicherheitsgründen werden Schmuck, Uhren, Piercings oder andere Gegenstände abgelegt oder abgeklebt.\n\n7. Achte auf deinen Partner\n\nDer Trainingspartner ist kein Gegner ? er ist dein Lehrer.\nWir trainieren kontrolliert, achtsam und verantwortungsvoll.\nWer aggressiv oder gefährlich trainiert, wird aus dem Training entfernt.\n\n8. Schutzausrüstung tragen\n\nBeim Sparring und in Kampfeinheiten ist die vorgeschriebene Schutzausrüstung verpflichtend.\n\n9. Techniken nur mit Erlaubnis\n\nGefährliche Techniken, Würfe, Joint Locks oder harte Sparringseinheiten dürfen nur mit Zustimmung des Trainers ausgeführt werden.\n\n10. Training auf eigene Verantwortung\n\nJeder trainiert im Rahmen seiner Möglichkeiten.\nSchmerzen, Verletzungen oder gesundheitliche Probleme müssen sofort gemeldet werden.\n\n11. Kein Essen auf der Matte\n\nTrinken ist erlaubt ? aber nur in Pausen und außerhalb der Mattenfläche.\nEssen, Süßigkeiten oder Kaugummi haben im Dojo nichts verloren.\n\n12. Konzentration ? kein Handy, kein Stress\n\nHandys bleiben lautlos, in der Tasche und außerhalb der Trainingsfläche.\nDas Dojo ist ein Ort innerer Ruhe und Fokus.\n\n13. Hilfsbereitschaft\n\nFortgeschrittene unterstützen Anfänger.\nJeder hilft jedem ? das Dojo ist eine Familie.\n\n14. Verhalten gegenüber Trainern\n\nDer Trainer trägt die Verantwortung für das Training.\nSeine Anweisungen sind jederzeit zu befolgen.\nKritik wird respektvoll und außerhalb des Trainings geäußert.\n\n15. Verhaltenskodex außerhalb des Dojos\n\nEin Mitglied der TDA Int?l repräsentiert den Verband ? auch außerhalb des Dojos.\nEhre, Respekt und Disziplin gelten überall, nicht nur auf der Matte.\n\n16. Keine unangekündigten Demonstrationen von Techniken\n\nTechniken werden nicht ohne Anweisung oder Partner ausgeführt, um Unfälle zu vermeiden.\n\n17. Grüßen der Trainer\n\nDer Unterricht beginnt und endet mit einer gemeinsamen Verbeugung.\nWer den Unterricht früher verlassen muss, meldet sich vorher beim Trainer ab und verneigt sich.\n\n18. Richtiges Verhalten bei Verletzungen\n\nSofort stoppen\n\nLaut und klar melden\n\nPartner schützen\n\nTrainer informieren\n\n19. Kein Training bei Krankheit\n\nBei Fieber, ansteckenden Erkrankungen oder Verletzungen darf nicht trainiert werden.\n\n20. Der Weg (Do) ist wichtiger als der Sieg\n\nWettkämpfe sind Teil des Weges, aber nicht der Zweck der Kampfkunst.\nEntwicklung, Charakterbildung und gegenseitiger Respekt stehen im Vordergrund.\n\n21. Respektiere das Dojo\n\nDas Dojo ist ein besonderer Ort, kein Fitnessstudio.\nHier wird nicht geflucht, gelärmt oder respektlos gehandelt.\n\nSchlusswort\n\nDie Dojo-Regeln sind ein zentraler Bestandteil der Kampfsportschule Schreiner.\nSie dienen dem Schutz, der Tradition und dem Wachstum jedes einzelnen Schülers.\n\nMit dem Betreten des Dojos werden diese Regeln anerkannt und gelebt.\n\n','Hausordnung der Kampfsportschule Schreiner  International\n\nDie nachfolgenden Regeln dienen der Sicherheit, Sauberkeit, Fairness und einem respektvollen Miteinander im gesamten Trainings- und Veranstaltungsbetrieb der Kampfsportschule Schreiner  International (im Folgenden TDA Intl).\n\nMit dem Betreten der Trainingsräume, Hallen oder Veranstaltungsorte erkennt jeder Teilnehmer, Besucher, Schüler, Trainer und Angehörige diese Hausordnung an.\n\n1. Allgemeines Verhalten\n\nRespekt, Höflichkeit und ein freundlicher Umgangston sind verpflichtend.\n\nAnweisungen des Trainers, der Aufsichtspersonen und des Veranstalters sind unbedingt zu befolgen.\n\nJede Form von Gewalt, Diskriminierung, Mobbing, Provokation oder respektlosem Verhalten wird nicht toleriert.\n\nBesucher und Teilnehmer haben sich so zu verhalten, dass niemand gefährdet, gestört oder beeinträchtigt wird.\n\nAlkohol, Drogen und andere berauschende Mittel sind auf dem Gelände verboten. Personen unter Einfluss solcher Substanzen werden vom Training ausgeschlossen.\n\n2. Sauberkeit & Ordnung\n\nDie Trainingsräume sind sauber zu halten.\n\nSchuhe sind nur in den dafür vorgesehenen Bereichen erlaubt  auf der Matte herrscht Barfußpflicht (Ausnahmen: medizinische Gründe, spezielle Matten-Schuhe).\n\nTaschen, Kleidung und persönliche Gegenstände sind ordnungsgemäß abzulegen und keine Stolpergefahr zu verursachen.\n\nJeder ist für die Sauberkeit seines Platzes und seiner Ausrüstung selbst verantwortlich.\n\nMüll bitte in die vorgesehenen Behälter werfen.\n\n3. Kleidung & Ausrüstung\n\nEs ist ordnungsgemäße Trainingskleidung zu tragen (z. B. Gi, Hose, Verbandskleidung, Schul-T-Shirt).\n\nDie Kleidung muss sauber, intakt und geruchsneutral sein.\n\nSchutzausrüstung (z. B. Handschuhe, Mundschutz, Tiefschutz, Schienbeinschoner) ist bei bestimmten Trainingseinheiten verpflichtend.\n\nSchmuck (Ringe, Ketten, Ohrringe, Piercings etc.) ist aus Sicherheitsgründen abzulegen oder abzukleben.\n\nLängere Haare müssen zusammengebunden sein.\n\n4. Sicherheit & Gesundheit\n\nTraining erfolgt stets auf eigene Gefahr; jeder achtet auf die eigenen körperlichen Grenzen.\n\nVerletzungen oder gesundheitliche Probleme müssen dem Trainer sofort gemeldet werden.\n\nDas Trainieren mit ansteckenden Krankheiten, offenen Wunden oder Fieber ist nicht erlaubt.\n\nGefährliche Techniken dürfen nur unter Aufsicht eines Trainers ausgeführt werden.\n\nWildes, unkontrolliertes oder aggressives Verhalten führt zum sofortigen Ausschluss aus dem Training.\n\n5. Matten- und Trainingsregeln\n\nDie Matte darf nur mit sauber gewaschenen Füßen betreten werden.\n\nEssen, Trinken (außer Wasser) und Kaugummi sind auf der Matte verboten.\n\nDas Verlassen der Matte während des Trainings muss beim Trainer angezeigt werden.\n\nSparring findet nur mit Erlaubnis des Trainers statt und unter Beachtung der festgelegten Regeln.\n\nEin fairer, verantwortungsvoller Umgang mit Trainingspartnern ist Pflicht.\n\n6. Verhalten gegenüber Trainern & Schülern\n\nDer Trainer ist während der Trainingseinheit weisungsbefugt.\n\nKritik oder Hinweise sind respektvoll und ausschließlich sachlich zu äußern.\n\nSchüler unterstützen und respektieren sich gegenseitig  unabhängig von Stil, Gürtelgrad, Herkunft, Geschlecht oder körperlicher Verfassung.\n\nDie höhere Graduierung verpflichtet zu Vorbildverhalten.\n\n7. Minderjährige Teilnehmer\n\nEltern oder Erziehungsberechtigte tragen die Verantwortung für die Aufsicht ihrer Kinder außerhalb des Trainings.\n\nKinder dürfen die Matten, Geräte und Räumlichkeiten nicht unbeaufsichtigt nutzen.\n\nUnnötiges Herumrennen im Dojo oder Wartebereich ist zu vermeiden.\n\nEltern dürfen das Training beobachten, aber die Einheit nicht stören.\n\n8. Geräte & Einrichtung\n\nTrainingsgeräte dürfen nur sachgerecht und vorsichtig benutzt werden.\n\nBeschädigungen sind sofort zu melden.\n\nMutwillige Beschädigungen führen zu Schadensersatzforderungen.\n\nGeräte müssen nach Benutzung an ihren Platz zurückgelegt werden.\n\n9. Garderobe & Wertsachen\n\nFür verloren gegangene oder gestohlene Gegenstände übernimmt TDA Intl keine Haftung.\n\nWertsachen sind selbst zu sichern oder nicht mitzuführen.\n\nDer Umkleidebereich ist sauber zu halten.\n\n10. Fotos, Videos & Öffentlichkeitsarbeit\n\nDas Filmen oder Fotografieren im Dojo ist nur mit Erlaubnis des Trainers oder Verbandes erlaubt.\n\nBei offiziellen Veranstaltungen dürfen von TDA Intl Fotos und Videos für Öffentlichkeitsarbeit erstellt werden.\n\nTeilnehmer können der Verwendung widersprechen, sofern keine berechtigten Interessen entgegenstehen.\n\n11. Teilnahmeausschluss & Sanktionen\n\nBei Verstößen gegen diese Hausordnung kann TDA Intl folgende Maßnahmen ergreifen:\n\nmündliche Verwarnung\n\nschriftliche Verwarnung\n\nAusschluss aus der Trainingseinheit\n\ntemporärer Trainingsverweis\n\nHausverbot\n\nfristlose Beendigung der Mitgliedschaft\n\nEin Anspruch auf Rückerstattung der Beiträge besteht nicht.\n\n12. Notfälle\n\nNotausgänge dürfen nicht blockiert werden.\n\nIm Notfall ist den Anweisungen des Personals Folge zu leisten.\n\nErste-Hilfe-Material ist nur im Ernstfall zu verwenden.\n\n13. Gültigkeit\n\nDiese Hausordnung gilt für:\n\nalle Trainingsräume und Hallen\n\nOutdoor-Trainingsbereiche\n\nWettkampf- und Eventorte\n\nSeminarräume\n\nVeranstaltungen, Turniere und Prüfungen\n\nalle Teilnehmer, Besucher und Mitglieder der Kampfsportschule Schreiner  International\n\nMit dem Betreten der Räumlichkeiten bzw. Teilnahme an Aktivitäten wird die Hausordnung anerkannt.\n','Widerrufsbelehrung mit Hinweis auf sofortigen Trainingsbeginn\n\nWiderrufsrecht\n\nDu hast das Recht, deine Mitgliedschaft innerhalb von 14 Tagen ohne Angabe von Gründen zu widerrufen.\n\nDie Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.\n\nUm dein Widerrufsrecht auszuüben, musst du uns (Kampfsportschule Schreiner  International, Ohmstr. 14, 84137 Vilsbiburg, info@tda-vib.de\n) mittels einer eindeutigen Erklärung (z. B. E-Mail oder Brief) über deinen Entschluss informieren, die Mitgliedschaft zu widerrufen.\n\nAusnahme: Verzicht auf das Widerrufsrecht bei sofortigem Trainingsbeginn\n\nWenn du ausdrücklich verlangst, dass die Mitgliedschaft bereits vor Ablauf der Widerrufsfrist beginnt und du sofort am Training teilnehmen möchtest, gilt Folgendes:\n\nDu bestätigst mit deinem Antrag ausdrücklich, dass du vor Ablauf der Widerrufsfrist sofort mit dem Training beginnen möchtest.\n\nDu bestätigst außerdem, dass dir bewusst ist, dass du bei vollständiger Vertragserfüllung durch uns dein Widerrufsrecht verlierst.\n\nFür Leistungen, die wir bis zum Zeitpunkt des Widerrufs bereits erbracht haben, musst du ggf. einen angemessenen anteiligen Betrag zahlen.\n\nBeispiel:\nWenn du nach Vertragsabschluss sofort trainierst und erst später innerhalb der Frist widerrufst, wird nur die bereits in Anspruch genommene Zeit berechnet.\n\nDiese Erklärung ist erforderlich, weil du sonst laut Gesetz erst nach Ablauf der 14 Tage trainieren dürftest.\n\nFolgen des Widerrufs\n\nWenn du die Mitgliedschaft innerhalb der Widerrufsfrist widerrufst, erstatten wir dir alle Zahlungen, abzüglich der anteiligen Kosten für bereits genutzte Leistungen, innerhalb von 14 Tagen ab Eingang deines Widerrufs.\n\nMuster-Widerrufsformular\n\n(Wenn du den Vertrag widerrufen möchtest, fülle folgendes Formular aus und sende es zurück.)\n\nAn:\nKampfsportschule Schreiner  International\nOhmstr. 14\n84137 Vilsbiburg\nE-Mail: info@tda-vib.de\n\nHiermit widerrufe ich die von mir abgeschlossene Mitgliedschaft.\n\nName: _______________________________________\n\nAnschrift: __________________________________\n\nDatum des Vertragsabschlusses: _______________\n\nDatum des Widerrufs: ________________________\n\nUnterschrift (bei Mitteilung auf Papier): ___________________________\n','','kleinunternehmer',0.00,22000.00,0.00,0.00,2025,0,0,1,0,NULL,'#FFD700','','','2026-01-08 20:21:33','default','Haftungsausschluss der Kampfsportschule Schreiner  International\n1. Allgemeines\n\nDie Teilnahme an sämtlichen Angeboten, Leistungen und Aktivitäten der Kampfsportschule Schreiner  International (im Folgenden TDA Intl) erfolgt grundsätzlich auf eigene Gefahr.\nDies umfasst insbesondere:\n\nTurniere und Wettkämpfe\n\nTrainings, Kurse, Workshops, Lehrgänge und Seminare\n\nHall-of-Fame-Veranstaltungen und Ehrungen\n\nPrüfungen, Graduierungen und Sparrings\n\nTrainingscamps und Outdoor-Aktivitäten\n\nVereins- und Verbandsveranstaltungen aller Art\n\nMitgliedschaften und Instructor-Programme\n\nFoto-, Video- und Medienaufnahmen\n\nsonstige sportliche oder gemeinschaftliche Veranstaltungen\n\nMit der Teilnahme erkennt jeder Teilnehmer, Erziehungsberechtigter oder Vertreter diesen Haftungsausschluss vollständig an.\n\n2. Gesundheitliche Voraussetzungen und Eigenverantwortung\n\nJeder Teilnehmer bestätigt, dass er:\n\nkörperlich und geistig in der Lage ist, an der jeweiligen Aktivität teilzunehmen,\n\nkeine gesundheitlichen Einschränkungen verheimlicht, die die Teilnahme riskant machen könnten (z. B. Herz-/Kreislaufprobleme, Asthma, Verletzungen, Operationen, Medikamente),\n\nin ausreichender körperlicher Verfassung für Kampfkunst/Kampfsport ist,\n\nselbstständig für angemessene Sportkleidung, Schutzausrüstung und gesundheitliche Vorsorge sorgt.\n\nDie Teilnahme setzt voraus, dass der Teilnehmer sein Training auf eigene Verantwortung gestaltet und auf Warnsignale seines Körpers achtet.\nIm Zweifel ist die Teilnahme zu unterlassen und medizinischer Rat einzuholen.\n\n3. Risiken bei Kampfkunst, Kampfsport & sportlichen Aktivitäten\n\nKampfkunst, Kampfsport und sportliche Bewegungsformen sind mit natürlichen Verletzungsrisiken verbunden, einschließlich, aber nicht beschränkt auf:\n\nPrellungen, Zerrungen, Verstauchungen\n\nVerletzungen der Bänder, Muskeln und Gelenke\n\nKnochenbrüche\n\nKopfverletzungen, Bewusstlosigkeit, Gehirnerschütterungen\n\nAtemnot, Kreislaufprobleme\n\nVerletzungen durch Dritte oder Trainingspartner\n\nSchäden an persönlichem Eigentum\n\nJeder Teilnehmer erklärt ausdrücklich, dass er sich dieser Risiken bewusst ist und sie eigenverantwortlich in Kauf nimmt.\n\n4. Haftung der TDA Intl\n\nDie Kampfsportschule Schreiner  International haftet nur im Rahmen der gesetzlichen Bestimmungen und ausschließlich bei:\n\nvorsätzlichem oder grob fahrlässigem Verhalten\n\nVerletzung von Leben, Körper oder Gesundheit, die auf fahrlässiger oder vorsätzlicher Pflichtverletzung beruhen\n\nzwingenden gesetzlichen Haftungsvorschriften (z. B. Produkthaftungsgesetz)\n\nIn allen anderen Fällen ist eine Haftung ausgeschlossen, insbesondere für:\n\neinfache Fahrlässigkeit\n\nVerletzungen, die durch sporttypische Risiken entstehen\n\nHandlungen Dritter (Teilnehmer, Zuschauer, Vereine, Trainer, Schiedsrichter)\n\nSchäden durch fehlende oder mangelhafte Angabe gesundheitlicher Einschränkungen\n\nselbstverschuldete Unfälle\n\nVerlust oder Beschädigung von Wertgegenständen, Kleidung oder Ausrüstung\n\nSchäden aufgrund höherer Gewalt (z. B. Wetter, Stromausfälle, technische Störungen)\n\n5. Haftungsausschluss für Turniere & Wettkämpfe\n\nBei Turnieren und Wettkämpfen bestätigt jeder Teilnehmer bzw. dessen Erziehungsberechtigter:\n\nDie Teilnahme erfolgt freiwillig und auf eigenes Risiko.\n\nDie Regeln, Sicherheitsvorschriften und Anweisungen der Offiziellen werden beachtet.\n\nDer Veranstalter übernimmt keine Haftung für Schäden, die durch Gegner, internes oder externes Fehlverhalten, Regelverstöße oder unvorhersehbare Kampfverläufe entstehen.\n\nDer Teilnehmer trägt selbst die Verantwortung für die vorgeschriebene Schutzausrüstung.\n\nEine gültige Krankenversicherung ist Voraussetzung.\n\nDie TDA Intl haftet nicht für Unfälle oder Verletzungen, die trotz eines regelkonformen Ablaufs auftreten.\n\n6. Haftungsausschluss für Seminare, Workshops & Training\n\nBei Trainings, Seminaren, Camps und Lehrgängen gilt:\n\nÜbungen können physische und psychische Belastungen mit sich bringen.\n\nJeder hat eigenverantwortlich zu prüfen, ob er die Übung sicher ausführen kann.\n\nDer Trainer stellt lediglich Anleitungen bereit  eine fehlerfreie Ausführung kann nicht garantiert werden.\n\nDer Teilnehmer trägt die Verantwortung, auf eigene Grenzen zu achten.\n\nFür Schäden durch unsachgemäße Selbstüberschätzung wird keine Haftung übernommen.\n\n7. Minderjährige Teilnehmer\n\nErziehungsberechtigte erkennen an:\n\ndass sie die Aufsichtspflicht gegenüber ihren Kindern selbst tragen, soweit diese nicht durch einen Trainer oder Betreuer übernommen wird,\n\ndass sie für Schäden haften, die ihre Kinder anderen zufügen,\n\ndass sie Risiken des Kampfsports kennen und akzeptieren,\n\ndass sie gesundheitliche Einschränkungen ihres Kindes dem Veranstalter mitteilen.\n\n8. Haftung für Ausrüstung & Eigentum\n\nDie TDA Intl übernimmt keine Verantwortung für:\n\nVerlust oder Diebstahl von Kleidung, Equipment oder Wertgegenständen\n\nBeschädigungen durch Fahrlässigkeit anderer Teilnehmer\n\nselbst mitgebrachte Trainingsgeräte oder Hilfsmittel\n\nJeder ist selbst für seine Gegenstände verantwortlich.\n\n9. Foto-, Video- und Medienaufnahmen\n\nBei allen Veranstaltungen kann die TDA Intl Foto- und Videoaufnahmen erstellen bzw. erstellen lassen.\n\nMit der Teilnahme erklärt jeder Teilnehmer bzw. Erziehungsberechtigte:\n\nEr ist einverstanden, dass Aufnahmen im Rahmen der Vereins-/Verbandsarbeit veröffentlicht werden dürfen (Website, Social Media, Turnierberichte, Printmedien usw.).\n\nEin Widerruf ist möglich, jedoch nicht rückwirkend für bereits veröffentlichte Materialien.\n\nBei Portrait- oder individuellen Aufnahmen kann eine gesonderte Einwilligung erforderlich sein.\n\n10. Verhalten, Regelverstöße & Ausschluss von der Teilnahme\n\nDie TDA Intl behält sich das Recht vor, Teilnehmer ohne Anspruch auf Rückerstattung auszuschließen, wenn:\n\nSicherheitsanweisungen missachtet werden,\n\ngesundheitliche Risiken verschwiegen wurden,\n\naggressives, gefährliches oder respektloses Verhalten gezeigt wird,\n\neine Gefährdung anderer Personen besteht.\n\n11. Höhere Gewalt & Veranstaltungsänderungen\n\nFür Ausfälle, Änderungen oder Abbruch einer Veranstaltung aufgrund von Ereignissen außerhalb unserer Kontrolle (z. B. Wetter, Krankheit des Trainers, technische Störungen, Pandemien) wird keine Haftung übernommen.\n\nBereits gezahlte Gebühren können nach Ermessen des Veranstalters erstattet, gutgeschrieben oder als Teilnahmeberechtigung für einen späteren Termin anerkannt werden.\n\n12. Versicherungen\n\nJeder Teilnehmer ist selbst dafür verantwortlich, über ausreichende Kranken-, Unfall- und Haftpflichtversicherung zu verfügen.\n\nDer Veranstalter übernimmt nicht die Kosten für Verletzungen oder Krankenhausaufenthalte, sofern dies nicht gesetzlich vorgeschrieben ist.\n\n13. Salvatorische Klausel\n\nSollten einzelne Bestimmungen dieses Haftungsausschlusses unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.\nAn die Stelle der unwirksamen Klausel tritt eine Regelung, die dem wirtschaftlichen Zweck am nächsten kommt.\n\n14. Anerkennung des Haftungsausschlusses\n\nMit der Teilnahme an jeglichen Aktivitäten, Veranstaltungen oder Programmen der Kampfsportschule Schreiner  International erkennt der Teilnehmer bzw. dessen Erziehungsberechtigter diesen Haftungsausschluss vollständig und verbindlich an.\n','2025-12-29 20:17:53','2025-12-28 21:42:49','245ec0b8-b033-4149-92c7-96b276c14f68',1,'2026-01-05 16:31:20','2025-09-02 08:34:23','active','free','2026-01-08 20:21:33',NULL,'2026-01-08 20:21:33',NULL),(4,'demo','demo1','Demo Zugang',NULL,NULL,NULL,NULL,'',NULL,'demo@zugang.de',NULL,NULL,NULL,NULL,0,'Deutschland',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,NULL,'Verein',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,3,12,14,NULL,1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,5.00,10.00,NULL,NULL,'#DAA520','de','Europe/Berlin','EUR',NULL,NULL,500,20,50,1,1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-01-06 06:05:13','2026-01-08 16:02:03',NULL,'1.0','manual_sepa',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'kleinunternehmer',0.00,22000.00,0.00,0.00,2025,0,0,1,0,0,'#FFD700',NULL,NULL,'2026-01-08 17:02:03','default',NULL,NULL,NULL,NULL,1,'2026-01-06 06:05:13','2026-01-20 07:05:13','trial','basic',NULL,NULL,NULL,'monthly');
/*!40000 ALTER TABLE `dojo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dojo_banken`
--

DROP TABLE IF EXISTS `dojo_banken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dojo_banken` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int NOT NULL,
  `bank_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_typ` enum('bank','stripe','paypal','sonstige') COLLATE utf8mb4_unicode_ci DEFAULT 'bank',
  `ist_aktiv` tinyint(1) DEFAULT '1',
  `ist_standard` tinyint(1) DEFAULT '0',
  `iban` varchar(34) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bic` varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kontoinhaber` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sepa_glaeubiger_id` varchar(35) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_publishable_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_secret_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_account_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paypal_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paypal_client_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paypal_client_secret` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_secret` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `merchant_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci,
  `sortierung` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dojo_id` (`dojo_id`),
  KEY `idx_bank_typ` (`bank_typ`),
  KEY `idx_ist_aktiv` (`ist_aktiv`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dojo_banken`
--

LOCK TABLES `dojo_banken` WRITE;
/*!40000 ALTER TABLE `dojo_banken` DISABLE KEYS */;
INSERT INTO `dojo_banken` VALUES (3,2,'Stripe','stripe',1,0,NULL,NULL,NULL,NULL,'pk_test_51JxYZ0123456789abcdefghijklmnopqrstuvwxyz','sk_test_51JxYZ9876543210zyxwvutsrqponmlkjihgfedcba','acct_1234567890ABCDEF',NULL,NULL,NULL,NULL,NULL,NULL,'Online-Zahlungen für Kursbuchungen und Shop',2,'2025-10-12 08:36:23','2025-10-12 08:36:23'),(4,2,'PayPal Business','paypal',1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'business@tigerdragondojo.de','AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq123456789','ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKkJj987654321',NULL,NULL,NULL,'Alternative Online-Zahlungsmethode für internationale Mitglieder',3,'2025-10-12 08:36:23','2025-10-12 08:36:23'),(7,3,'Stripe','stripe',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2025-10-25 05:58:22','2025-10-25 05:58:22'),(8,3,'Stripe','stripe',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2025-10-25 05:58:22','2025-10-25 05:58:22'),(9,3,'PayPal','paypal',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-10-25 05:58:22','2025-10-25 05:58:22'),(10,3,'PayPal','paypal',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-10-25 05:58:22','2025-10-25 05:58:22');
/*!40000 ALTER TABLE `dojo_banken` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dojo_logos`
--

DROP TABLE IF EXISTS `dojo_logos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dojo_logos` (
  `logo_id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int NOT NULL,
  `logo_type` enum('haupt','alternativ','partner1','partner2','social') COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL COMMENT 'Größe in Bytes',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  PRIMARY KEY (`logo_id`),
  UNIQUE KEY `unique_dojo_logo` (`dojo_id`,`logo_type`),
  KEY `idx_dojo_id` (`dojo_id`),
  CONSTRAINT `dojo_logos_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dojo_logos`
--

LOCK TABLES `dojo_logos` WRITE;
/*!40000 ALTER TABLE `dojo_logos` DISABLE KEYS */;
INSERT INTO `dojo_logos` VALUES (1,2,'haupt','66 (3).jfif','/var/www/dojosoftware/backend/uploads/logos/dojo-2-undefined-1766161298453-746785864.jfif',4935,'image/jpeg','2025-12-19 16:21:38',NULL);
/*!40000 ALTER TABLE `dojo_logos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dojo_subscriptions`
--

DROP TABLE IF EXISTS `dojo_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dojo_subscriptions` (
  `subscription_id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int NOT NULL,
  `subdomain` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_type` enum('trial','starter','professional','premium','enterprise') COLLATE utf8mb4_unicode_ci DEFAULT 'trial',
  `status` enum('active','trial','suspended','cancelled','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'trial',
  `feature_verkauf` tinyint(1) DEFAULT '0' COMMENT 'Verkauf & Lagerhaltung',
  `feature_buchfuehrung` tinyint(1) DEFAULT '0' COMMENT 'Rechnungen, Mahnwesen, Finanzcockpit',
  `feature_events` tinyint(1) DEFAULT '0' COMMENT 'Event-Verwaltung',
  `feature_multidojo` tinyint(1) DEFAULT '0' COMMENT 'Mehrere Standorte verwalten',
  `feature_api` tinyint(1) DEFAULT '0' COMMENT 'API-Zugang',
  `max_members` int DEFAULT '50' COMMENT 'Maximale Anzahl aktiver Mitglieder',
  `max_dojos` int DEFAULT '1' COMMENT 'Anzahl verwaltbarer Dojos',
  `storage_limit_mb` int DEFAULT '1000' COMMENT 'Speicherplatz für Dokumente in MB',
  `current_storage_mb` int DEFAULT '0' COMMENT 'Aktuell genutzter Speicher',
  `trial_ends_at` datetime DEFAULT NULL COMMENT 'Ende der Trial-Phase',
  `subscription_starts_at` datetime DEFAULT NULL COMMENT 'Start des bezahlten Abos',
  `subscription_ends_at` datetime DEFAULT NULL COMMENT 'Ende des aktuellen Abo-Zeitraums',
  `cancelled_at` datetime DEFAULT NULL COMMENT 'Kündigungsdatum',
  `monthly_price` decimal(10,2) DEFAULT '0.00' COMMENT 'Monatlicher Preis in EUR',
  `billing_interval` enum('monthly','yearly') COLLATE utf8mb4_unicode_ci DEFAULT 'monthly',
  `billing_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Rechnungs-Email',
  `payment_method` enum('sepa','invoice','creditcard') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`subscription_id`),
  UNIQUE KEY `dojo_id` (`dojo_id`),
  UNIQUE KEY `subdomain` (`subdomain`),
  KEY `idx_subdomain` (`subdomain`),
  KEY `idx_plan_type` (`plan_type`),
  KEY `idx_status` (`status`),
  CONSTRAINT `dojo_subscriptions_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dojo_subscriptions`
--

LOCK TABLES `dojo_subscriptions` WRITE;
/*!40000 ALTER TABLE `dojo_subscriptions` DISABLE KEYS */;
INSERT INTO `dojo_subscriptions` VALUES (1,2,'dojo-2','premium','active',1,1,1,0,0,999999,1,1000,0,NULL,NULL,NULL,NULL,0.00,'monthly',NULL,NULL,'2026-01-05 16:31:20','2026-01-05 16:31:20'),(2,3,'dojo-3','premium','active',1,1,1,0,0,999999,1,1000,0,NULL,NULL,NULL,NULL,0.00,'monthly',NULL,NULL,'2026-01-05 16:31:20','2026-01-05 16:31:20'),(4,4,'demo1','trial','trial',0,0,0,0,0,100,1,1000,0,'2026-01-20 07:05:13',NULL,NULL,NULL,49.00,'monthly','demo@zugang.de',NULL,'2026-01-06 06:05:13','2026-01-06 06:05:13');
/*!40000 ALTER TABLE `dojo_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dokument_templates`
--

DROP TABLE IF EXISTS `dokument_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dokument_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `typ` enum('mitgliederliste','anwesenheit','beitraege','statistiken','pruefungen','vertrag','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `template_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Template-Konfiguration (Layout, Spalten, etc.)',
  `ist_standard` tinyint(1) DEFAULT '0',
  `aktiv` tinyint(1) DEFAULT '1',
  `erstellt_am` datetime DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_typ` (`typ`),
  KEY `idx_ist_standard` (`ist_standard`),
  CONSTRAINT `dokument_templates_chk_1` CHECK (json_valid(`template_config`))
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Vorlagen f├╝r verschiedene Dokumenttypen';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dokument_templates`
--

LOCK TABLES `dokument_templates` WRITE;
/*!40000 ALTER TABLE `dokument_templates` DISABLE KEYS */;
INSERT INTO `dokument_templates` VALUES (1,'Standard Mitgliederliste','mitgliederliste','Vollst├ñndige Liste aller aktiven Mitglieder mit Kontaktdaten','{\"columns\": [\"mitgliedsnummer\", \"name\", \"vorname\", \"geburtsdatum\", \"email\", \"telefon\", \"status\"], \"groupBy\": null, \"showDate\": true, \"showLogo\": true, \"orientation\": \"landscape\"}',1,1,'2025-10-10 06:54:33','2025-10-10 06:54:33'),(2,'Anwesenheitsliste Monat','anwesenheit','Monatliche Anwesenheits├╝bersicht','{\"columns\": [\"name\", \"datum\", \"uhrzeit\", \"kurs\", \"trainer\"], \"groupBy\": \"kurs\", \"showLogo\": true, \"orientation\": \"landscape\", \"showStatistics\": true}',1,1,'2025-10-10 06:54:33','2025-10-10 06:54:33'),(3,'Beitrags├╝bersicht','beitraege','├£bersicht ├╝ber Mitgliedsbeitr├ñge und Zahlungen','{\"columns\": [\"mitglied\", \"beitrag\", \"status\", \"faellig_am\", \"bezahlt_am\"], \"showLogo\": true, \"showTotals\": true, \"orientation\": \"portrait\", \"filterStatus\": \"alle\"}',1,1,'2025-10-10 06:54:33','2025-10-10 06:54:33'),(4,'Pr├╝fungsurkunde','pruefungen','Urkunde f├╝r bestandene G├╝rtelpr├╝fungen','{\"showDate\": true, \"showLogo\": true, \"borderStyle\": \"elegant\", \"orientation\": \"landscape\", \"showSignature\": true}',1,1,'2025-10-10 06:54:33','2025-10-10 06:54:33'),(5,'Standard Mitgliederliste','mitgliederliste','Vollst├ñndige Liste aller aktiven Mitglieder mit Kontaktdaten','{\"columns\": [\"mitgliedsnummer\", \"name\", \"vorname\", \"geburtsdatum\", \"email\", \"telefon\", \"status\"], \"groupBy\": null, \"showDate\": true, \"showLogo\": true, \"orientation\": \"landscape\"}',1,1,'2025-10-10 06:55:10','2025-10-10 06:55:10'),(6,'Anwesenheitsliste Monat','anwesenheit','Monatliche Anwesenheits├╝bersicht','{\"columns\": [\"name\", \"datum\", \"uhrzeit\", \"kurs\", \"trainer\"], \"groupBy\": \"kurs\", \"showLogo\": true, \"orientation\": \"landscape\", \"showStatistics\": true}',1,1,'2025-10-10 06:55:10','2025-10-10 06:55:10'),(7,'Beitrags├╝bersicht','beitraege','├£bersicht ├╝ber Mitgliedsbeitr├ñge und Zahlungen','{\"columns\": [\"mitglied\", \"beitrag\", \"status\", \"faellig_am\", \"bezahlt_am\"], \"showLogo\": true, \"showTotals\": true, \"orientation\": \"portrait\", \"filterStatus\": \"alle\"}',1,1,'2025-10-10 06:55:10','2025-10-10 06:55:10'),(8,'Pr├╝fungsurkunde','pruefungen','Urkunde f├╝r bestandene G├╝rtelpr├╝fungen','{\"showDate\": true, \"showLogo\": true, \"borderStyle\": \"elegant\", \"orientation\": \"landscape\", \"showSignature\": true}',1,1,'2025-10-10 06:55:10','2025-10-10 06:55:10'),(9,'Standard Mitgliederliste','mitgliederliste','Vollst├ñndige Liste aller aktiven Mitglieder mit Kontaktdaten','{\"columns\": [\"mitgliedsnummer\", \"name\", \"vorname\", \"geburtsdatum\", \"email\", \"telefon\", \"status\"], \"groupBy\": null, \"showDate\": true, \"showLogo\": true, \"orientation\": \"landscape\"}',1,1,'2025-10-10 06:55:41','2025-10-10 06:55:41'),(10,'Anwesenheitsliste Monat','anwesenheit','Monatliche Anwesenheits├╝bersicht','{\"columns\": [\"name\", \"datum\", \"uhrzeit\", \"kurs\", \"trainer\"], \"groupBy\": \"kurs\", \"showLogo\": true, \"orientation\": \"landscape\", \"showStatistics\": true}',1,1,'2025-10-10 06:55:41','2025-10-10 06:55:41'),(11,'Beitrags├╝bersicht','beitraege','├£bersicht ├╝ber Mitgliedsbeitr├ñge und Zahlungen','{\"columns\": [\"mitglied\", \"beitrag\", \"status\", \"faellig_am\", \"bezahlt_am\"], \"showLogo\": true, \"showTotals\": true, \"orientation\": \"portrait\", \"filterStatus\": \"alle\"}',1,1,'2025-10-10 06:55:41','2025-10-10 06:55:41'),(12,'Pr├╝fungsurkunde','pruefungen','Urkunde f├╝r bestandene G├╝rtelpr├╝fungen','{\"showDate\": true, \"showLogo\": true, \"borderStyle\": \"elegant\", \"orientation\": \"landscape\", \"showSignature\": true}',1,1,'2025-10-10 06:55:41','2025-10-10 06:55:41'),(13,'Standard Mitgliederliste','mitgliederliste','Vollst├ñndige Liste aller aktiven Mitglieder mit Kontaktdaten','{\"columns\": [\"mitgliedsnummer\", \"name\", \"vorname\", \"geburtsdatum\", \"email\", \"telefon\", \"status\"], \"groupBy\": null, \"showDate\": true, \"showLogo\": true, \"orientation\": \"landscape\"}',1,1,'2025-10-10 06:57:08','2025-10-10 06:57:08'),(14,'Anwesenheitsliste Monat','anwesenheit','Monatliche Anwesenheits├╝bersicht','{\"columns\": [\"name\", \"datum\", \"uhrzeit\", \"kurs\", \"trainer\"], \"groupBy\": \"kurs\", \"showLogo\": true, \"orientation\": \"landscape\", \"showStatistics\": true}',1,1,'2025-10-10 06:57:08','2025-10-10 06:57:08'),(15,'Beitrags├╝bersicht','beitraege','├£bersicht ├╝ber Mitgliedsbeitr├ñge und Zahlungen','{\"columns\": [\"mitglied\", \"beitrag\", \"status\", \"faellig_am\", \"bezahlt_am\"], \"showLogo\": true, \"showTotals\": true, \"orientation\": \"portrait\", \"filterStatus\": \"alle\"}',1,1,'2025-10-10 06:57:08','2025-10-10 06:57:08'),(16,'Pr├╝fungsurkunde','pruefungen','Urkunde f├╝r bestandene G├╝rtelpr├╝fungen','{\"showDate\": true, \"showLogo\": true, \"borderStyle\": \"elegant\", \"orientation\": \"landscape\", \"showSignature\": true}',1,1,'2025-10-10 06:57:08','2025-10-10 06:57:08'),(17,'Standard Mitgliederliste','mitgliederliste','Vollst├ñndige Liste aller aktiven Mitglieder mit Kontaktdaten','{\"columns\": [\"mitgliedsnummer\", \"name\", \"vorname\", \"geburtsdatum\", \"email\", \"telefon\", \"status\"], \"groupBy\": null, \"showDate\": true, \"showLogo\": true, \"orientation\": \"landscape\"}',1,1,'2025-10-10 06:57:50','2025-10-10 06:57:50'),(18,'Anwesenheitsliste Monat','anwesenheit','Monatliche Anwesenheits├╝bersicht','{\"columns\": [\"name\", \"datum\", \"uhrzeit\", \"kurs\", \"trainer\"], \"groupBy\": \"kurs\", \"showLogo\": true, \"orientation\": \"landscape\", \"showStatistics\": true}',1,1,'2025-10-10 06:57:50','2025-10-10 06:57:50'),(19,'Beitrags├╝bersicht','beitraege','├£bersicht ├╝ber Mitgliedsbeitr├ñge und Zahlungen','{\"columns\": [\"mitglied\", \"beitrag\", \"status\", \"faellig_am\", \"bezahlt_am\"], \"showLogo\": true, \"showTotals\": true, \"orientation\": \"portrait\", \"filterStatus\": \"alle\"}',1,1,'2025-10-10 06:57:50','2025-10-10 06:57:50'),(20,'Pr├╝fungsurkunde','pruefungen','Urkunde f├╝r bestandene G├╝rtelpr├╝fungen','{\"showDate\": true, \"showLogo\": true, \"borderStyle\": \"elegant\", \"orientation\": \"landscape\", \"showSignature\": true}',1,1,'2025-10-10 06:57:50','2025-10-10 06:57:50'),(21,'Mitgliedschaftsvertrag Standard','vertrag','Professioneller Mitgliedschaftsvertrag mit allen rechtlichen Elementen (AGB, DSGVO, SEPA)','{\"showLogo\": true, \"includeAGB\": true, \"includeSEPA\": true, \"orientation\": \"portrait\", \"includeDSGVO\": true, \"showSignature\": true, \"includeWiderruf\": true}',1,1,'2025-10-10 07:04:53','2025-10-10 07:04:53');
/*!40000 ALTER TABLE `dokument_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dokumente`
--

DROP TABLE IF EXISTS `dokumente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dokumente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `typ` enum('mitgliederliste','anwesenheit','beitraege','statistiken','pruefungen','vertrag','custom') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'custom',
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `dateiname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dateipfad` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateityp` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'PDF',
  `dateigroesse` int DEFAULT NULL COMMENT 'Dateigr├Â├ƒe in Bytes',
  `erstellt_am` datetime DEFAULT CURRENT_TIMESTAMP,
  `erstellt_von` int DEFAULT NULL COMMENT 'User ID des Erstellers',
  `parameter` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Generierungs-Parameter als JSON',
  `status` enum('erstellt','archiviert','geloescht') COLLATE utf8mb4_unicode_ci DEFAULT 'erstellt',
  `downloads` int DEFAULT '0' COMMENT 'Anzahl der Downloads',
  `letzter_download` datetime DEFAULT NULL,
  `gueltig_bis` date DEFAULT NULL COMMENT 'Optional: Ablaufdatum',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`id`),
  KEY `idx_typ` (`typ`),
  KEY `idx_erstellt_am` (`erstellt_am`),
  KEY `idx_status` (`status`),
  KEY `idx_dokumente_dojo_id` (`dojo_id`),
  CONSTRAINT `dokumente_chk_1` CHECK (json_valid(`parameter`))
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Speichert alle generierten PDF-Dokumente und Berichte';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dokumente`
--

LOCK TABLES `dokumente` WRITE;
/*!40000 ALTER TABLE `dokumente` DISABLE KEYS */;
INSERT INTO `dokumente` VALUES (4,'Statistiken_2025-12-04','statistiken',NULL,'statistiken_1764832490033.pdf','/var/www/dojosoftware/backend/uploads/dokumente/statistiken_1764832490033.pdf','PDF',1381,'2025-12-04 08:14:50',NULL,'{\"generatedAt\":\"2025-12-04T07:14:50.468Z\"}','erstellt',0,NULL,NULL,1),(5,'Beitragsübersicht_2025-12-04','beitraege',NULL,'beitraege_1764832514268.pdf','/var/www/dojosoftware/backend/uploads/dokumente/beitraege_1764832514268.pdf','PDF',1386,'2025-12-04 08:15:14',NULL,'{\"generatedAt\":\"2025-12-04T07:15:14.712Z\"}','erstellt',0,NULL,NULL,1),(6,'Prüfungsurkunden_2025-12-08','pruefungen',NULL,'pruefungen_1765208397972.pdf','/var/www/dojosoftware/backend/uploads/dokumente/pruefungen_1765208397972.pdf','PDF',1384,'2025-12-08 16:39:57',NULL,'{\"generatedAt\":\"2025-12-08T15:39:57.588Z\"}','erstellt',0,NULL,NULL,1),(7,'Statistiken_2025-12-12','statistiken',NULL,'statistiken_1765545703882.pdf','/var/www/dojosoftware/backend/uploads/dokumente/statistiken_1765545703882.pdf','PDF',1381,'2025-12-12 14:21:43',NULL,'{\"generatedAt\":\"2025-12-12T13:21:44.084Z\"}','erstellt',0,NULL,NULL,1),(8,'Prüfungsurkunden_2025-12-21','pruefungen',NULL,'pruefungen_1766351300079.pdf','/var/www/dojosoftware/backend/uploads/dokumente/pruefungen_1766351300079.pdf','PDF',1385,'2025-12-21 22:08:20',NULL,'{\"generatedAt\":\"2025-12-21T21:08:19.674Z\"}','erstellt',0,NULL,NULL,1);
/*!40000 ALTER TABLE `dokumente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ehemalige`
--

DROP TABLE IF EXISTS `ehemalige`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ehemalige` (
  `id` int NOT NULL AUTO_INCREMENT,
  `urspruengliches_mitglied_id` int DEFAULT NULL COMMENT 'Referenz zum ursprünglichen Mitglied in mitglieder-Tabelle',
  `dojo_id` int NOT NULL COMMENT 'Dojo-Zuordnung (Tax Compliance)',
  `vorname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nachname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `geburtsdatum` date DEFAULT NULL,
  `geschlecht` enum('m','w','d') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon_mobil` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hausnummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `urspruengliches_eintrittsdatum` date DEFAULT NULL COMMENT 'Datum des ursprünglichen Eintritts',
  `austrittsdatum` date DEFAULT NULL COMMENT 'Datum des Austritts',
  `austrittsgrund` text COLLATE utf8mb4_unicode_ci COMMENT 'Grund für den Austritt',
  `letzter_tarif` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Letzter gebuchter Tarif',
  `letzter_guertel` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Letzter erreichter Gürtel/Graduierung',
  `letzter_stil` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Letzter trainierter Stil',
  `notizen` text COLLATE utf8mb4_unicode_ci COMMENT 'Interne Notizen zum ehemaligen Mitglied',
  `wiederaufnahme_moeglich` tinyint(1) DEFAULT '1' COMMENT 'Kann das Mitglied wieder aufgenommen werden?',
  `wiederaufnahme_gesperrt_bis` date DEFAULT NULL COMMENT 'Gesperrt bis zu diesem Datum',
  `archiviert` tinyint(1) DEFAULT '0' COMMENT 'Komplett archiviert (nicht mehr in Listen anzeigen)',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ehemalige_dojo` (`dojo_id`),
  KEY `idx_ehemalige_name` (`nachname`,`vorname`),
  KEY `idx_ehemalige_austrittsdatum` (`austrittsdatum`),
  KEY `idx_ehemalige_archiviert` (`archiviert`),
  KEY `idx_ehemalige_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ehemalige Mitglieder mit vollständiger Historie';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ehemalige`
--

LOCK TABLES `ehemalige` WRITE;
/*!40000 ALTER TABLE `ehemalige` DISABLE KEYS */;
/*!40000 ALTER TABLE `ehemalige` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_templates`
--

DROP TABLE IF EXISTS `email_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_category` (`category`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `email_templates_chk_1` CHECK (json_valid(`variables`))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_templates`
--

LOCK TABLES `email_templates` WRITE;
/*!40000 ALTER TABLE `email_templates` DISABLE KEYS */;
INSERT INTO `email_templates` VALUES (1,'welcome','Willkommen im Dojo!','<h2>Willkommen {{name}}!</h2>\r\n<p>Herzlich willkommen in unserem Dojo! Wir freuen uns, Sie als neues Mitglied begrüßen zu dürfen.</p>\r\n<p><strong>Ihre Mitgliedsdaten:</strong></p>\r\n<ul>\r\n    <li>Name: {{name}}</li>\r\n    <li>Email: {{email}}</li>\r\n    <li>Mitgliedschaft: {{membership_type}}</li>\r\n    <li>Startdatum: {{start_date}}</li>\r\n</ul>\r\n<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>\r\n<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>','[\"name\", \"email\", \"membership_type\", \"start_date\"]','welcome',1,'2025-10-15 10:42:12','2025-10-15 10:42:12'),(2,'payment_reminder','Beitragserinnerung - {{month}}','<h2>Beitragserinnerung</h2>\r\n<p>Liebe/r {{name}},</p>\r\n<p>dies ist eine freundliche Erinnerung, dass Ihr Mitgliedsbeitrag für {{month}} noch aussteht.</p>\r\n<p><strong>Betrag:</strong> {{amount}} €<br>\r\n<strong>Fälligkeitsdatum:</strong> {{due_date}}</p>\r\n<p>Bitte überweisen Sie den Betrag zeitnah, um Ihre Mitgliedschaft aufrechtzuerhalten.</p>\r\n<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>\r\n<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>','[\"name\", \"month\", \"amount\", \"due_date\"]','payment',1,'2025-10-15 10:42:12','2025-10-15 10:42:12'),(3,'course_cancellation','Kursabsage: {{course_name}}','<h2>Kursabsage</h2>\r\n<p>Liebe/r {{name}},</p>\r\n<p>leider müssen wir den Kurs \"{{course_name}}\" am {{date}} um {{time}} absagen.</p>\r\n<p><strong>Grund:</strong> {{reason}}</p>\r\n<p>Wir bemühen uns um einen Ersatztermin und informieren Sie sobald wie möglich.</p>\r\n<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>\r\n<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>','[\"name\", \"course_name\", \"date\", \"time\", \"reason\"]','course',1,'2025-10-15 10:42:12','2025-10-15 10:42:12'),(4,'exam_notification','Prüfungstermin: {{belt_color}} Gürtel','<h2>Prüfungstermin</h2>\r\n<p>Liebe/r {{name}},</p>\r\n<p>wir freuen uns, Ihnen mitteilen zu können, dass Sie zur {{belt_color}} Gürtelprüfung eingeladen sind.</p>\r\n<p><strong>Datum:</strong> {{exam_date}}<br>\r\n<strong>Uhrzeit:</strong> {{exam_time}}<br>\r\n<strong>Ort:</strong> {{location}}</p>\r\n<p>Bitte erscheinen Sie pünktlich und in vollständiger Trainingsausrüstung.</p>\r\n<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>\r\n<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>','[\"name\", \"belt_color\", \"exam_date\", \"exam_time\", \"location\"]','exam',1,'2025-10-15 10:42:12','2025-10-15 10:42:12'),(5,'newsletter_general','{{newsletter_title}}','<h2>{{newsletter_title}}</h2>\r\n<p>Liebe Dojo-Mitglieder,</p>\r\n{{newsletter_content}}\r\n<p>Vielen Dank für Ihr Interesse an unserem Dojo!</p>\r\n<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>\r\n<p><small>Sie erhalten diese Email, weil Sie unseren Newsletter abonniert haben. <a href=\"{{unsubscribe_link}}\">Hier abmelden</a></small></p>','[\"newsletter_title\", \"newsletter_content\", \"unsubscribe_link\"]','newsletter',1,'2025-10-15 10:42:12','2025-10-15 10:42:12');
/*!40000 ALTER TABLE `email_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ereignisse`
--

DROP TABLE IF EXISTS `ereignisse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ereignisse` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int DEFAULT NULL,
  `ereignis_typ` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ereignisse`
--

LOCK TABLES `ereignisse` WRITE;
/*!40000 ALTER TABLE `ereignisse` DISABLE KEYS */;
/*!40000 ALTER TABLE `ereignisse` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_anmeldungen`
--

DROP TABLE IF EXISTS `event_anmeldungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_anmeldungen` (
  `anmeldung_id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `mitglied_id` int NOT NULL,
  `anmeldedatum` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('angemeldet','bestaetigt','abgesagt','teilgenommen','nicht_erschienen') COLLATE utf8mb4_unicode_ci DEFAULT 'angemeldet',
  `bezahlt` tinyint(1) DEFAULT '0',
  `bezahldatum` datetime DEFAULT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`anmeldung_id`),
  UNIQUE KEY `unique_event_mitglied` (`event_id`,`mitglied_id`),
  KEY `idx_event` (`event_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `event_anmeldungen_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE,
  CONSTRAINT `event_anmeldungen_ibfk_2` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_anmeldungen`
--

LOCK TABLES `event_anmeldungen` WRITE;
/*!40000 ALTER TABLE `event_anmeldungen` DISABLE KEYS */;
INSERT INTO `event_anmeldungen` VALUES (1,1,138,'2025-12-18 16:07:47','bestaetigt',1,'2025-12-18 17:07:47','Durch Admin hinzugefügt','2025-12-18 16:07:47','2025-12-18 16:07:47'),(2,1,1,'2025-12-18 16:13:25','bestaetigt',1,'2025-12-18 17:19:07','Durch Admin hinzugefügt','2025-12-18 16:13:25','2025-12-18 16:19:07');
/*!40000 ALTER TABLE `event_anmeldungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_dateien`
--

DROP TABLE IF EXISTS `event_dateien`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_dateien` (
  `datei_id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `dateiname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dateipfad` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dateityp` enum('dokument','bild','video','sonstiges') COLLATE utf8mb4_unicode_ci DEFAULT 'dokument',
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `hochgeladen_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `hochgeladen_von` int DEFAULT NULL COMMENT 'Admin/Trainer ID',
  PRIMARY KEY (`datei_id`),
  KEY `idx_event` (`event_id`),
  CONSTRAINT `event_dateien_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_dateien`
--

LOCK TABLES `event_dateien` WRITE;
/*!40000 ALTER TABLE `event_dateien` DISABLE KEYS */;
/*!40000 ALTER TABLE `event_dateien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_nachrichten`
--

DROP TABLE IF EXISTS `event_nachrichten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_nachrichten` (
  `nachricht_id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `verfasser_id` int NOT NULL COMMENT 'Mitglied oder Admin ID',
  `verfasser_typ` enum('mitglied','admin','trainer') COLLATE utf8mb4_unicode_ci DEFAULT 'mitglied',
  `nachricht` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`nachricht_id`),
  KEY `idx_event` (`event_id`),
  CONSTRAINT `event_nachrichten_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_nachrichten`
--

LOCK TABLES `event_nachrichten` WRITE;
/*!40000 ALTER TABLE `event_nachrichten` DISABLE KEYS */;
/*!40000 ALTER TABLE `event_nachrichten` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `event_id` int NOT NULL AUTO_INCREMENT,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `event_typ` enum('Turnier','Lehrgang','PrÃ¼fung','Seminar','Workshop','Feier','Sonstiges') COLLATE utf8mb4_unicode_ci DEFAULT 'Sonstiges',
  `datum` date NOT NULL,
  `uhrzeit_beginn` time DEFAULT NULL,
  `uhrzeit_ende` time DEFAULT NULL,
  `ort` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raum_id` int DEFAULT NULL,
  `max_teilnehmer` int DEFAULT NULL,
  `teilnahmegebuehr` decimal(10,2) DEFAULT '0.00',
  `anmeldefrist` date DEFAULT NULL,
  `status` enum('geplant','anmeldung_offen','ausgebucht','abgeschlossen','abgesagt') COLLATE utf8mb4_unicode_ci DEFAULT 'geplant',
  `trainer_ids` text COLLATE utf8mb4_unicode_ci COMMENT 'Komma-getrennte Liste von Trainer-IDs',
  `dojo_id` int NOT NULL DEFAULT '1',
  `bild_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `anforderungen` text COLLATE utf8mb4_unicode_ci COMMENT 'Voraussetzungen fÃ¼r Teilnahme',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  KEY `raum_id` (`raum_id`),
  KEY `idx_datum` (`datum`),
  KEY `idx_status` (`status`),
  KEY `idx_dojo` (`dojo_id`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE,
  CONSTRAINT `events_ibfk_2` FOREIGN KEY (`raum_id`) REFERENCES `raeume` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
INSERT INTO `events` VALUES (1,'Weißwursttraining',NULL,'Sonstiges','2026-01-24','10:00:00','16:00:00','Dojo Vilsbiburg',NULL,NULL,0.00,'2026-01-20','geplant','2,4,3,10',2,NULL,NULL,'2025-12-16 09:51:24','2025-12-16 09:51:24');
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `finanzaemter`
--

DROP TABLE IF EXISTS `finanzaemter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finanzaemter` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ort` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bundesland` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `finanzamtnummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_custom` tinyint(1) DEFAULT '0' COMMENT 'True wenn vom Benutzer hinzugefügt',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_ort` (`ort`),
  KEY `idx_bundesland` (`bundesland`),
  KEY `idx_search` (`name`,`ort`,`bundesland`)
) ENGINE=InnoDB AUTO_INCREMENT=272 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finanzaemter`
--

LOCK TABLES `finanzaemter` WRITE;
/*!40000 ALTER TABLE `finanzaemter` DISABLE KEYS */;
INSERT INTO `finanzaemter` VALUES (1,'Finanzamt Aalen','Aalen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2811',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(2,'Finanzamt Albstadt-Ebingen','Albstadt','Baden-Württemberg',NULL,NULL,NULL,NULL,'2812',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(3,'Finanzamt Balingen','Balingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2813',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(4,'Finanzamt Böblingen','Böblingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2814',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(5,'Finanzamt Bruchsal','Bruchsal','Baden-Württemberg',NULL,NULL,NULL,NULL,'2815',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(6,'Finanzamt Bühl','Bühl','Baden-Württemberg',NULL,NULL,NULL,NULL,'2816',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(7,'Finanzamt Calw','Calw','Baden-Württemberg',NULL,NULL,NULL,NULL,'2817',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(8,'Finanzamt Emmendingen','Emmendingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2818',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(9,'Finanzamt Esslingen','Esslingen am Neckar','Baden-Württemberg',NULL,NULL,NULL,NULL,'2819',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(10,'Finanzamt Freiburg-Stadt','Freiburg im Breisgau','Baden-Württemberg',NULL,NULL,NULL,NULL,'2820',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(11,'Finanzamt Freiburg-Land','Freiburg im Breisgau','Baden-Württemberg',NULL,NULL,NULL,NULL,'2821',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(12,'Finanzamt Freudenstadt','Freudenstadt','Baden-Württemberg',NULL,NULL,NULL,NULL,'2822',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(13,'Finanzamt Göppingen','Göppingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2823',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(14,'Finanzamt Heidelberg','Heidelberg','Baden-Württemberg',NULL,NULL,NULL,NULL,'2824',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(15,'Finanzamt Heidenheim','Heidenheim an der Brenz','Baden-Württemberg',NULL,NULL,NULL,NULL,'2825',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(16,'Finanzamt Heilbronn','Heilbronn','Baden-Württemberg',NULL,NULL,NULL,NULL,'2826',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(17,'Finanzamt Karlsruhe-Durlach','Karlsruhe','Baden-Württemberg',NULL,NULL,NULL,NULL,'2827',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(18,'Finanzamt Karlsruhe-Stadt','Karlsruhe','Baden-Württemberg',NULL,NULL,NULL,NULL,'2828',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(19,'Finanzamt Kehl','Kehl','Baden-Württemberg',NULL,NULL,NULL,NULL,'2829',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(20,'Finanzamt Konstanz','Konstanz','Baden-Württemberg',NULL,NULL,NULL,NULL,'2830',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(21,'Finanzamt Lahr','Lahr/Schwarzwald','Baden-Württemberg',NULL,NULL,NULL,NULL,'2831',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(22,'Finanzamt Ludwigsburg','Ludwigsburg','Baden-Württemberg',NULL,NULL,NULL,NULL,'2832',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(23,'Finanzamt Mannheim','Mannheim','Baden-Württemberg',NULL,NULL,NULL,NULL,'2833',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(24,'Finanzamt Nürtingen','Nürtingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2834',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(25,'Finanzamt Offenburg','Offenburg','Baden-Württemberg',NULL,NULL,NULL,NULL,'2835',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(26,'Finanzamt Pforzheim','Pforzheim','Baden-Württemberg',NULL,NULL,NULL,NULL,'2836',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(27,'Finanzamt Rastatt','Rastatt','Baden-Württemberg',NULL,NULL,NULL,NULL,'2837',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(28,'Finanzamt Ravensburg','Ravensburg','Baden-Württemberg',NULL,NULL,NULL,NULL,'2838',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(29,'Finanzamt Reutlingen','Reutlingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2839',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(30,'Finanzamt Rottweil','Rottweil','Baden-Württemberg',NULL,NULL,NULL,NULL,'2840',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(31,'Finanzamt Schwäbisch Hall','Schwäbisch Hall','Baden-Württemberg',NULL,NULL,NULL,NULL,'2841',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(32,'Finanzamt Singen','Singen (Hohentwiel)','Baden-Württemberg',NULL,NULL,NULL,NULL,'2842',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(33,'Finanzamt Stuttgart I','Stuttgart','Baden-Württemberg',NULL,NULL,NULL,NULL,'2843',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(34,'Finanzamt Stuttgart II','Stuttgart','Baden-Württemberg',NULL,NULL,NULL,NULL,'2844',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(35,'Finanzamt Stuttgart III','Stuttgart','Baden-Württemberg',NULL,NULL,NULL,NULL,'2845',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(36,'Finanzamt Tübingen','Tübingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2846',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(37,'Finanzamt Tuttlingen','Tuttlingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2847',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(38,'Finanzamt Ulm','Ulm','Baden-Württemberg',NULL,NULL,NULL,NULL,'2848',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(39,'Finanzamt Villingen-Schwenningen','Villingen-Schwenningen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2849',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(40,'Finanzamt Waiblingen','Waiblingen','Baden-Württemberg',NULL,NULL,NULL,NULL,'2850',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(41,'Finanzamt Amberg','Amberg','Bayern',NULL,NULL,NULL,NULL,'2851',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(42,'Finanzamt Ansbach','Ansbach','Bayern',NULL,NULL,NULL,NULL,'2852',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(43,'Finanzamt Aschaffenburg','Aschaffenburg','Bayern',NULL,NULL,NULL,NULL,'2853',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(44,'Finanzamt Augsburg-Stadt','Augsburg','Bayern',NULL,NULL,NULL,NULL,'2854',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(45,'Finanzamt Augsburg-Land','Augsburg','Bayern',NULL,NULL,NULL,NULL,'2855',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(46,'Finanzamt Bad Kissingen','Bad Kissingen','Bayern',NULL,NULL,NULL,NULL,'2856',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(47,'Finanzamt Bad Tölz-Wolfratshausen','Bad Tölz','Bayern',NULL,NULL,NULL,NULL,'2857',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(48,'Finanzamt Bamberg','Bamberg','Bayern',NULL,NULL,NULL,NULL,'2858',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(49,'Finanzamt Bayreuth','Bayreuth','Bayern',NULL,NULL,NULL,NULL,'2859',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(50,'Finanzamt Coburg','Coburg','Bayern',NULL,NULL,NULL,NULL,'2860',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(51,'Finanzamt Deggendorf','Deggendorf','Bayern',NULL,NULL,NULL,NULL,'2861',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(52,'Finanzamt Dillingen a.d. Donau','Dillingen an der Donau','Bayern',NULL,NULL,NULL,NULL,'2862',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(53,'Finanzamt Dingolfing-Landau','Dingolfing','Bayern',NULL,NULL,NULL,NULL,'2863',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(54,'Finanzamt Donauwörth','Donauwörth','Bayern',NULL,NULL,NULL,NULL,'2864',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(55,'Finanzamt Ebersberg','Ebersberg','Bayern',NULL,NULL,NULL,NULL,'2865',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(56,'Finanzamt Eichstätt','Eichstätt','Bayern',NULL,NULL,NULL,NULL,'2866',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(57,'Finanzamt Erlangen','Erlangen','Bayern',NULL,NULL,NULL,NULL,'2867',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(58,'Finanzamt Freising','Freising','Bayern',NULL,NULL,NULL,NULL,'2868',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(59,'Finanzamt Fürstenfeldbruck','Fürstenfeldbruck','Bayern',NULL,NULL,NULL,NULL,'2869',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(60,'Finanzamt Fürth','Fürth','Bayern',NULL,NULL,NULL,NULL,'2870',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(61,'Finanzamt Garmisch-Partenkirchen','Garmisch-Partenkirchen','Bayern',NULL,NULL,NULL,NULL,'2871',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(62,'Finanzamt Günzburg','Günzburg','Bayern',NULL,NULL,NULL,NULL,'2872',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(63,'Finanzamt Ingolstadt','Ingolstadt','Bayern',NULL,NULL,NULL,NULL,'2873',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(64,'Finanzamt Kaufbeuren','Kaufbeuren','Bayern',NULL,NULL,NULL,NULL,'2874',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(65,'Finanzamt Kempten','Kempten (Allgäu)','Bayern',NULL,NULL,NULL,NULL,'2875',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(66,'Finanzamt Kitzingen','Kitzingen','Bayern',NULL,NULL,NULL,NULL,'2876',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(67,'Finanzamt Kronach','Kronach','Bayern',NULL,NULL,NULL,NULL,'2877',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(68,'Finanzamt Kulmbach','Kulmbach','Bayern',NULL,NULL,NULL,NULL,'2878',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(69,'Finanzamt Landsberg am Lech','Landsberg am Lech','Bayern',NULL,NULL,NULL,NULL,'2879',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(70,'Finanzamt Landshut','Landshut','Bayern',NULL,NULL,NULL,NULL,'2880',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(71,'Finanzamt Lichtenfels','Lichtenfels','Bayern',NULL,NULL,NULL,NULL,'2881',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(72,'Finanzamt Lindau','Lindau (Bodensee)','Bayern',NULL,NULL,NULL,NULL,'2882',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(73,'Finanzamt Mainburg','Mainburg','Bayern',NULL,NULL,NULL,NULL,'2883',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(74,'Finanzamt Memmingen','Memmingen','Bayern',NULL,NULL,NULL,NULL,'2884',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(75,'Finanzamt Mindelheim','Mindelheim','Bayern',NULL,NULL,NULL,NULL,'2885',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(76,'Finanzamt Mühldorf a. Inn','Mühldorf am Inn','Bayern',NULL,NULL,NULL,NULL,'2886',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(77,'Finanzamt München I','München','Bayern',NULL,NULL,NULL,NULL,'2887',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(78,'Finanzamt München II','München','Bayern',NULL,NULL,NULL,NULL,'2888',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(79,'Finanzamt München III','München','Bayern',NULL,NULL,NULL,NULL,'2889',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(80,'Finanzamt München IV','München','Bayern',NULL,NULL,NULL,NULL,'2890',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(81,'Finanzamt München V','München','Bayern',NULL,NULL,NULL,NULL,'2891',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(82,'Finanzamt Neu-Ulm','Neu-Ulm','Bayern',NULL,NULL,NULL,NULL,'2892',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(83,'Finanzamt Neuburg-Schrobenhausen','Neuburg an der Donau','Bayern',NULL,NULL,NULL,NULL,'2893',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(84,'Finanzamt Neumarkt i.d. OPf.','Neumarkt in der Oberpfalz','Bayern',NULL,NULL,NULL,NULL,'2894',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(85,'Finanzamt Neustadt a.d. Aisch','Neustadt an der Aisch','Bayern',NULL,NULL,NULL,NULL,'2895',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(86,'Finanzamt Neustadt a.d. Waldnaab','Neustadt an der Waldnaab','Bayern',NULL,NULL,NULL,NULL,'2896',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(87,'Finanzamt Nürnberg','Nürnberg','Bayern',NULL,NULL,NULL,NULL,'2897',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(88,'Finanzamt Nürnberg-Land','Nürnberg','Bayern',NULL,NULL,NULL,NULL,'2898',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(89,'Finanzamt Passau','Passau','Bayern',NULL,NULL,NULL,NULL,'2899',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(90,'Finanzamt Pfaffenhofen a.d. Ilm','Pfaffenhofen an der Ilm','Bayern',NULL,NULL,NULL,NULL,'2900',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(91,'Finanzamt Regen','Regen','Bayern',NULL,NULL,NULL,NULL,'2901',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(92,'Finanzamt Regensburg','Regensburg','Bayern',NULL,NULL,NULL,NULL,'2902',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(93,'Finanzamt Rosenheim','Rosenheim','Bayern',NULL,NULL,NULL,NULL,'2903',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(94,'Finanzamt Roth','Roth','Bayern',NULL,NULL,NULL,NULL,'2904',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(95,'Finanzamt Rottal-Inn','Pfarrkirchen','Bayern',NULL,NULL,NULL,NULL,'2905',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(96,'Finanzamt Schwandorf','Schwandorf','Bayern',NULL,NULL,NULL,NULL,'2906',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(97,'Finanzamt Schweinfurt','Schweinfurt','Bayern',NULL,NULL,NULL,NULL,'2907',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(98,'Finanzamt Starnberg','Starnberg','Bayern',NULL,NULL,NULL,NULL,'2908',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(99,'Finanzamt Straubing','Straubing','Bayern',NULL,NULL,NULL,NULL,'2909',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(100,'Finanzamt Traunstein','Traunstein','Bayern',NULL,NULL,NULL,NULL,'2910',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(101,'Finanzamt Weiden i.d. OPf.','Weiden in der Oberpfalz','Bayern',NULL,NULL,NULL,NULL,'2911',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(102,'Finanzamt Weilheim-Schongau','Weilheim in Oberbayern','Bayern',NULL,NULL,NULL,NULL,'2912',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(103,'Finanzamt Weißenburg-Gunzenhausen','Weißenburg in Bayern','Bayern',NULL,NULL,NULL,NULL,'2913',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(104,'Finanzamt Würzburg','Würzburg','Bayern',NULL,NULL,NULL,NULL,'2914',0,'2025-10-12 08:25:18','2025-10-12 08:25:18'),(105,'Finanzamt Berlin I','Berlin','Berlin',NULL,NULL,NULL,NULL,'2915',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(106,'Finanzamt Berlin II','Berlin','Berlin',NULL,NULL,NULL,NULL,'2916',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(107,'Finanzamt Berlin III','Berlin','Berlin',NULL,NULL,NULL,NULL,'2917',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(108,'Finanzamt Berlin IV','Berlin','Berlin',NULL,NULL,NULL,NULL,'2918',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(109,'Finanzamt Berlin V','Berlin','Berlin',NULL,NULL,NULL,NULL,'2919',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(110,'Finanzamt Berlin VI','Berlin','Berlin',NULL,NULL,NULL,NULL,'2920',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(111,'Finanzamt Berlin VII','Berlin','Berlin',NULL,NULL,NULL,NULL,'2921',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(112,'Finanzamt Berlin VIII','Berlin','Berlin',NULL,NULL,NULL,NULL,'2922',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(113,'Finanzamt Berlin IX','Berlin','Berlin',NULL,NULL,NULL,NULL,'2923',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(114,'Finanzamt Berlin X','Berlin','Berlin',NULL,NULL,NULL,NULL,'2924',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(115,'Finanzamt Berlin XI','Berlin','Berlin',NULL,NULL,NULL,NULL,'2925',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(116,'Finanzamt Berlin XII','Berlin','Berlin',NULL,NULL,NULL,NULL,'2926',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(117,'Finanzamt Brandenburg an der Havel','Brandenburg an der Havel','Brandenburg',NULL,NULL,NULL,NULL,'2927',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(118,'Finanzamt Cottbus','Cottbus','Brandenburg',NULL,NULL,NULL,NULL,'2928',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(119,'Finanzamt Frankfurt (Oder)','Frankfurt (Oder)','Brandenburg',NULL,NULL,NULL,NULL,'2929',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(120,'Finanzamt Neuruppin','Neuruppin','Brandenburg',NULL,NULL,NULL,NULL,'2930',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(121,'Finanzamt Potsdam','Potsdam','Brandenburg',NULL,NULL,NULL,NULL,'2931',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(122,'Finanzamt Bremen','Bremen','Bremen',NULL,NULL,NULL,NULL,'2932',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(123,'Finanzamt Bremerhaven','Bremerhaven','Bremen',NULL,NULL,NULL,NULL,'2933',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(124,'Finanzamt Hamburg I','Hamburg','Hamburg',NULL,NULL,NULL,NULL,'2934',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(125,'Finanzamt Hamburg II','Hamburg','Hamburg',NULL,NULL,NULL,NULL,'2935',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(126,'Finanzamt Hamburg III','Hamburg','Hamburg',NULL,NULL,NULL,NULL,'2936',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(127,'Finanzamt Bad Homburg v.d. Höhe','Bad Homburg vor der Höhe','Hessen',NULL,NULL,NULL,NULL,'2937',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(128,'Finanzamt Darmstadt','Darmstadt','Hessen',NULL,NULL,NULL,NULL,'2938',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(129,'Finanzamt Darmstadt-Dieburg','Darmstadt','Hessen',NULL,NULL,NULL,NULL,'2939',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(130,'Finanzamt Frankfurt am Main I','Frankfurt am Main','Hessen',NULL,NULL,NULL,NULL,'2940',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(131,'Finanzamt Frankfurt am Main II','Frankfurt am Main','Hessen',NULL,NULL,NULL,NULL,'2941',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(132,'Finanzamt Frankfurt am Main III','Frankfurt am Main','Hessen',NULL,NULL,NULL,NULL,'2942',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(133,'Finanzamt Frankfurt am Main IV','Frankfurt am Main','Hessen',NULL,NULL,NULL,NULL,'2943',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(134,'Finanzamt Frankfurt am Main V','Frankfurt am Main','Hessen',NULL,NULL,NULL,NULL,'2944',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(135,'Finanzamt Gießen','Gießen','Hessen',NULL,NULL,NULL,NULL,'2945',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(136,'Finanzamt Hanau','Hanau','Hessen',NULL,NULL,NULL,NULL,'2946',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(137,'Finanzamt Kassel','Kassel','Hessen',NULL,NULL,NULL,NULL,'2947',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(138,'Finanzamt Kassel-Land','Kassel','Hessen',NULL,NULL,NULL,NULL,'2948',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(139,'Finanzamt Limburg-Weilburg','Limburg an der Lahn','Hessen',NULL,NULL,NULL,NULL,'2949',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(140,'Finanzamt Marburg-Biedenkopf','Marburg','Hessen',NULL,NULL,NULL,NULL,'2950',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(141,'Finanzamt Offenbach am Main','Offenbach am Main','Hessen',NULL,NULL,NULL,NULL,'2951',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(142,'Finanzamt Rüsselsheim','Rüsselsheim am Main','Hessen',NULL,NULL,NULL,NULL,'2952',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(143,'Finanzamt Schwalm-Eder','Schwalmstadt','Hessen',NULL,NULL,NULL,NULL,'2953',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(144,'Finanzamt Wetzlar','Wetzlar','Hessen',NULL,NULL,NULL,NULL,'2954',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(145,'Finanzamt Wiesbaden','Wiesbaden','Hessen',NULL,NULL,NULL,NULL,'2955',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(146,'Finanzamt Greifswald','Greifswald','Mecklenburg-Vorpommern',NULL,NULL,NULL,NULL,'2956',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(147,'Finanzamt Neubrandenburg','Neubrandenburg','Mecklenburg-Vorpommern',NULL,NULL,NULL,NULL,'2957',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(148,'Finanzamt Rostock','Rostock','Mecklenburg-Vorpommern',NULL,NULL,NULL,NULL,'2958',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(149,'Finanzamt Schwerin','Schwerin','Mecklenburg-Vorpommern',NULL,NULL,NULL,NULL,'2959',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(150,'Finanzamt Aurich','Aurich','Niedersachsen',NULL,NULL,NULL,NULL,'2960',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(151,'Finanzamt Braunschweig','Braunschweig','Niedersachsen',NULL,NULL,NULL,NULL,'2961',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(152,'Finanzamt Celle','Celle','Niedersachsen',NULL,NULL,NULL,NULL,'2962',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(153,'Finanzamt Cloppenburg','Cloppenburg','Niedersachsen',NULL,NULL,NULL,NULL,'2963',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(154,'Finanzamt Cuxhaven','Cuxhaven','Niedersachsen',NULL,NULL,NULL,NULL,'2964',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(155,'Finanzamt Göttingen','Göttingen','Niedersachsen',NULL,NULL,NULL,NULL,'2965',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(156,'Finanzamt Hannover-Land I','Hannover','Niedersachsen',NULL,NULL,NULL,NULL,'2966',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(157,'Finanzamt Hannover-Land II','Hannover','Niedersachsen',NULL,NULL,NULL,NULL,'2967',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(158,'Finanzamt Hannover-Stadt','Hannover','Niedersachsen',NULL,NULL,NULL,NULL,'2968',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(159,'Finanzamt Hildesheim','Hildesheim','Niedersachsen',NULL,NULL,NULL,NULL,'2969',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(160,'Finanzamt Lingen','Lingen (Ems)','Niedersachsen',NULL,NULL,NULL,NULL,'2970',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(161,'Finanzamt Lüneburg','Lüneburg','Niedersachsen',NULL,NULL,NULL,NULL,'2971',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(162,'Finanzamt Nienburg','Nienburg/Weser','Niedersachsen',NULL,NULL,NULL,NULL,'2972',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(163,'Finanzamt Northeim','Northeim','Niedersachsen',NULL,NULL,NULL,NULL,'2973',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(164,'Finanzamt Oldenburg','Oldenburg','Niedersachsen',NULL,NULL,NULL,NULL,'2974',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(165,'Finanzamt Osnabrück','Osnabrück','Niedersachsen',NULL,NULL,NULL,NULL,'2975',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(166,'Finanzamt Osterholz-Scharmbeck','Osterholz-Scharmbeck','Niedersachsen',NULL,NULL,NULL,NULL,'2976',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(167,'Finanzamt Peine','Peine','Niedersachsen',NULL,NULL,NULL,NULL,'2977',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(168,'Finanzamt Stade','Stade','Niedersachsen',NULL,NULL,NULL,NULL,'2978',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(169,'Finanzamt Uelzen','Uelzen','Niedersachsen',NULL,NULL,NULL,NULL,'2979',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(170,'Finanzamt Verden','Verden (Aller)','Niedersachsen',NULL,NULL,NULL,NULL,'2980',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(171,'Finanzamt Walsrode','Walsrode','Niedersachsen',NULL,NULL,NULL,NULL,'2981',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(172,'Finanzamt Wilhelmshaven','Wilhelmshaven','Niedersachsen',NULL,NULL,NULL,NULL,'2982',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(173,'Finanzamt Wolfenbüttel','Wolfenbüttel','Niedersachsen',NULL,NULL,NULL,NULL,'2983',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(174,'Finanzamt Aachen','Aachen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2984',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(175,'Finanzamt Ahlen','Ahlen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2985',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(176,'Finanzamt Arnsberg','Arnsberg','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2986',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(177,'Finanzamt Bielefeld','Bielefeld','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2987',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(178,'Finanzamt Bochum','Bochum','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2988',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(179,'Finanzamt Bonn','Bonn','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2989',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(180,'Finanzamt Bottrop','Bottrop','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2990',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(181,'Finanzamt Coesfeld','Coesfeld','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2991',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(182,'Finanzamt Dinslaken','Dinslaken','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2992',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(183,'Finanzamt Düren','Düren','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2993',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(184,'Finanzamt Düsseldorf-Altstadt','Düsseldorf','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2994',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(185,'Finanzamt Düsseldorf-Benrath','Düsseldorf','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2995',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(186,'Finanzamt Düsseldorf-Mettmann','Mettmann','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2996',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(187,'Finanzamt Düsseldorf-Süd','Düsseldorf','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2997',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(188,'Finanzamt Essen','Essen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2998',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(189,'Finanzamt Gelsenkirchen','Gelsenkirchen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'2999',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(190,'Finanzamt Hagen','Hagen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3000',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(191,'Finanzamt Hamm','Hamm','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3001',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(192,'Finanzamt Hattingen','Hattingen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3002',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(193,'Finanzamt Herne','Herne','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3003',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(194,'Finanzamt Köln-Altstadt','Köln','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3004',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(195,'Finanzamt Köln-Mülheim','Köln','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3005',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(196,'Finanzamt Köln-Ost','Köln','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3006',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(197,'Finanzamt Köln-West','Köln','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3007',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(198,'Finanzamt Krefeld','Krefeld','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3008',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(199,'Finanzamt Leverkusen','Leverkusen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3009',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(200,'Finanzamt Lüdenscheid','Lüdenscheid','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3010',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(201,'Finanzamt Mönchengladbach','Mönchengladbach','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3011',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(202,'Finanzamt Mülheim an der Ruhr','Mülheim an der Ruhr','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3012',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(203,'Finanzamt Münster','Münster','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3013',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(204,'Finanzamt Neuss','Neuss','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3014',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(205,'Finanzamt Oberhausen','Oberhausen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3015',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(206,'Finanzamt Paderborn','Paderborn','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3016',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(207,'Finanzamt Recklinghausen','Recklinghausen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3017',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(208,'Finanzamt Remscheid','Remscheid','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3018',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(209,'Finanzamt Siegen','Siegen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3019',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(210,'Finanzamt Solingen','Solingen','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3020',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(211,'Finanzamt Steinfurt','Steinfurt','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3021',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(212,'Finanzamt Unna','Unna','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3022',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(213,'Finanzamt Velbert','Velbert','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3023',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(214,'Finanzamt Wuppertal','Wuppertal','Nordrhein-Westfalen',NULL,NULL,NULL,NULL,'3024',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(215,'Finanzamt Alzey-Worms','Alzey','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3025',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(216,'Finanzamt Bad Kreuznach','Bad Kreuznach','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3026',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(217,'Finanzamt Germersheim','Germersheim','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3027',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(218,'Finanzamt Kaiserslautern','Kaiserslautern','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3028',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(219,'Finanzamt Koblenz','Koblenz','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3029',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(220,'Finanzamt Kusel','Kusel','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3030',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(221,'Finanzamt Landau','Landau in der Pfalz','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3031',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(222,'Finanzamt Ludwigshafen am Rhein','Ludwigshafen am Rhein','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3032',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(223,'Finanzamt Mainz','Mainz','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3033',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(224,'Finanzamt Neustadt an der Weinstraße','Neustadt an der Weinstraße','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3034',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(225,'Finanzamt Pirmasens','Pirmasens','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3035',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(226,'Finanzamt Speyer','Speyer','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3036',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(227,'Finanzamt Trier','Trier','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3037',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(228,'Finanzamt Wittlich','Wittlich','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3038',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(229,'Finanzamt Zweibrücken','Zweibrücken','Rheinland-Pfalz',NULL,NULL,NULL,NULL,'3039',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(230,'Finanzamt Homburg','Homburg','Saarland',NULL,NULL,NULL,NULL,'3040',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(231,'Finanzamt Saarbrücken','Saarbrücken','Saarland',NULL,NULL,NULL,NULL,'3041',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(232,'Finanzamt Saarlouis','Saarlouis','Saarland',NULL,NULL,NULL,NULL,'3042',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(233,'Finanzamt Annaberg','Annaberg-Buchholz','Sachsen',NULL,NULL,NULL,NULL,'3043',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(234,'Finanzamt Aue-Schwarzenberg','Aue','Sachsen',NULL,NULL,NULL,NULL,'3044',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(235,'Finanzamt Bautzen','Bautzen','Sachsen',NULL,NULL,NULL,NULL,'3045',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(236,'Finanzamt Chemnitz','Chemnitz','Sachsen',NULL,NULL,NULL,NULL,'3046',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(237,'Finanzamt Dresden','Dresden','Sachsen',NULL,NULL,NULL,NULL,'3047',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(238,'Finanzamt Freiberg','Freiberg','Sachsen',NULL,NULL,NULL,NULL,'3048',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(239,'Finanzamt Görlitz','Görlitz','Sachsen',NULL,NULL,NULL,NULL,'3049',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(240,'Finanzamt Leipzig','Leipzig','Sachsen',NULL,NULL,NULL,NULL,'3050',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(241,'Finanzamt Plauen','Plauen','Sachsen',NULL,NULL,NULL,NULL,'3051',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(242,'Finanzamt Zwickau','Zwickau','Sachsen',NULL,NULL,NULL,NULL,'3052',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(243,'Finanzamt Dessau-Roßlau','Dessau-Roßlau','Sachsen-Anhalt',NULL,NULL,NULL,NULL,'3053',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(244,'Finanzamt Halberstadt','Halberstadt','Sachsen-Anhalt',NULL,NULL,NULL,NULL,'3054',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(245,'Finanzamt Halle (Saale)','Halle (Saale)','Sachsen-Anhalt',NULL,NULL,NULL,NULL,'3055',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(246,'Finanzamt Magdeburg','Magdeburg','Sachsen-Anhalt',NULL,NULL,NULL,NULL,'3056',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(247,'Finanzamt Stendal','Stendal','Sachsen-Anhalt',NULL,NULL,NULL,NULL,'3057',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(248,'Finanzamt Bad Segeberg','Bad Segeberg','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3058',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(249,'Finanzamt Elmshorn','Elmshorn','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3059',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(250,'Finanzamt Flensburg','Flensburg','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3060',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(251,'Finanzamt Itzehoe','Itzehoe','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3061',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(252,'Finanzamt Kiel','Kiel','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3062',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(253,'Finanzamt Lübeck','Lübeck','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3063',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(254,'Finanzamt Neumünster','Neumünster','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3064',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(255,'Finanzamt Norderstedt','Norderstedt','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3065',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(256,'Finanzamt Pinneberg','Pinneberg','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3066',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(257,'Finanzamt Rendsburg','Rendsburg','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3067',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(258,'Finanzamt Schleswig','Schleswig','Schleswig-Holstein',NULL,NULL,NULL,NULL,'3068',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(259,'Finanzamt Altenburg','Altenburg','Thüringen',NULL,NULL,NULL,NULL,'3069',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(260,'Finanzamt Arnstadt','Arnstadt','Thüringen',NULL,NULL,NULL,NULL,'3070',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(261,'Finanzamt Erfurt','Erfurt','Thüringen',NULL,NULL,NULL,NULL,'3071',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(262,'Finanzamt Gera','Gera','Thüringen',NULL,NULL,NULL,NULL,'3072',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(263,'Finanzamt Gotha','Gotha','Thüringen',NULL,NULL,NULL,NULL,'3073',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(264,'Finanzamt Jena','Jena','Thüringen',NULL,NULL,NULL,NULL,'3074',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(265,'Finanzamt Meiningen','Meiningen','Thüringen',NULL,NULL,NULL,NULL,'3075',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(266,'Finanzamt Mühlhausen','Mühlhausen','Thüringen',NULL,NULL,NULL,NULL,'3076',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(267,'Finanzamt Nordhausen','Nordhausen','Thüringen',NULL,NULL,NULL,NULL,'3077',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(268,'Finanzamt Rudolstadt','Rudolstadt','Thüringen',NULL,NULL,NULL,NULL,'3078',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(269,'Finanzamt Sondershausen','Sondershausen','Thüringen',NULL,NULL,NULL,NULL,'3079',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(270,'Finanzamt Suhl','Suhl','Thüringen',NULL,NULL,NULL,NULL,'3080',0,'2025-10-12 08:25:19','2025-10-12 08:25:19'),(271,'Finanzamt Weimar','Weimar','Thüringen',NULL,NULL,NULL,NULL,'3081',0,'2025-10-12 08:25:19','2025-10-12 08:25:19');
/*!40000 ALTER TABLE `finanzaemter` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fortschritt_kategorien`
--

DROP TABLE IF EXISTS `fortschritt_kategorien`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fortschritt_kategorien` (
  `kategorie_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'target',
  `farbe_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#ffd700',
  `reihenfolge` int DEFAULT '0',
  `aktiv` tinyint(1) DEFAULT '1',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`kategorie_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fortschritt_kategorien`
--

LOCK TABLES `fortschritt_kategorien` WRITE;
/*!40000 ALTER TABLE `fortschritt_kategorien` DISABLE KEYS */;
INSERT INTO `fortschritt_kategorien` VALUES (1,'Techniken','Martial Arts Techniken und Bewegungen','zap','#ffd700',1,1,'2025-10-07 19:36:26'),(2,'Fitness','Kondition, Kraft und Ausdauer','activity','#ff6b35',2,1,'2025-10-07 19:36:26'),(3,'Flexibilität','Dehnübungen und Beweglichkeit','wind','#06B6D4',3,1,'2025-10-07 19:36:26'),(4,'Kata/Formen','Kata, Formen und Choreografien','layers','#8B5CF6',4,1,'2025-10-07 19:36:26'),(5,'Kumite/Sparring','Kampf und Sparring Fähigkeiten','shield','#EF4444',5,1,'2025-10-07 19:36:26'),(6,'Theorie','Wissen über Martial Arts Geschichte und Philosophie','book','#10B981',6,1,'2025-10-07 19:36:26');
/*!40000 ALTER TABLE `fortschritt_kategorien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fortschritt_updates`
--

DROP TABLE IF EXISTS `fortschritt_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fortschritt_updates` (
  `update_id` int NOT NULL AUTO_INCREMENT,
  `fortschritt_id` int NOT NULL,
  `mitglied_id` int NOT NULL,
  `alter_fortschritt` int DEFAULT NULL,
  `neuer_fortschritt` int DEFAULT NULL,
  `alter_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `neuer_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notiz` text COLLATE utf8mb4_unicode_ci,
  `trainer_feedback` text COLLATE utf8mb4_unicode_ci,
  `aktualisiert_von` int DEFAULT NULL,
  `aktualisiert_von_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `update_timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`update_id`),
  KEY `idx_fortschritt` (`fortschritt_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_timestamp` (`update_timestamp`),
  CONSTRAINT `fortschritt_updates_ibfk_1` FOREIGN KEY (`fortschritt_id`) REFERENCES `mitglieder_fortschritt` (`fortschritt_id`) ON DELETE CASCADE,
  CONSTRAINT `fortschritt_updates_ibfk_2` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fortschritt_updates`
--

LOCK TABLES `fortschritt_updates` WRITE;
/*!40000 ALTER TABLE `fortschritt_updates` DISABLE KEYS */;
/*!40000 ALTER TABLE `fortschritt_updates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gesetzlicher_vertreter`
--

DROP TABLE IF EXISTS `gesetzlicher_vertreter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gesetzlicher_vertreter` (
  `vertreter_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `typ` enum('externe Person','Mitglied') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `adresse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`vertreter_id`),
  KEY `mitglied_id` (`mitglied_id`),
  CONSTRAINT `gesetzlicher_vertreter_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gesetzlicher_vertreter`
--

LOCK TABLES `gesetzlicher_vertreter` WRITE;
/*!40000 ALTER TABLE `gesetzlicher_vertreter` DISABLE KEYS */;
/*!40000 ALTER TABLE `gesetzlicher_vertreter` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `graduierungen`
--

DROP TABLE IF EXISTS `graduierungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `graduierungen` (
  `graduierung_id` int NOT NULL AUTO_INCREMENT,
  `stil_id` int NOT NULL COMMENT 'Zugehöriger Stil',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Name der Graduierung (z.B. Weißgurt, Schwarzgurt)',
  `reihenfolge` int NOT NULL COMMENT 'Reihenfolge der Graduierung (1 = niedrigste)',
  `trainingsstunden_min` int DEFAULT '40' COMMENT 'Mindest-Trainingsstunden für diese Graduierung',
  `mindestzeit_monate` int DEFAULT '3' COMMENT 'Mindestzeit in Monaten bis zur nächsten Prüfung',
  `farbe_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#FFFFFF' COMMENT 'Farbe der Graduierung als HEX-Code',
  `farbe_sekundaer` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aktiv` tinyint(1) DEFAULT '1' COMMENT 'Ist die Graduierung aktiv?',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `kategorie` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dan_grad` int DEFAULT NULL,
  PRIMARY KEY (`graduierung_id`),
  UNIQUE KEY `uk_stil_reihenfolge` (`stil_id`,`reihenfolge`),
  UNIQUE KEY `uk_stil_name` (`stil_id`,`name`),
  KEY `idx_graduierung_stil` (`stil_id`),
  KEY `idx_graduierung_aktiv` (`aktiv`),
  KEY `idx_graduierung_reihenfolge` (`reihenfolge`),
  CONSTRAINT `graduierungen_ibfk_1` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gürtel-Graduierungen pro Kampfkunst-Stil';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `graduierungen`
--

LOCK TABLES `graduierungen` WRITE;
/*!40000 ALTER TABLE `graduierungen` DISABLE KEYS */;
INSERT INTO `graduierungen` VALUES (23,7,'Weißgurt',1,0,0,'#FFFFFF',NULL,1,'2025-08-25 05:15:37','2025-12-18 20:29:17',NULL,NULL),(24,7,'Gelbgurt',2,45,3,'#FFD700',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09','grundstufe',NULL),(25,7,'Grüngurt',3,65,5,'#32CD32',NULL,1,'2025-08-25 05:15:37','2025-12-18 20:29:17',NULL,NULL),(26,7,'Blaugurt',4,85,8,'#0066CC',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(27,7,'Rotgurt',5,105,12,'#DC143C',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(28,7,'Schwarzgurt 1. Dan',7,150,18,'#000000',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(29,3,'Weißgurt',1,0,0,'#FFFFFF',NULL,1,'2025-08-25 05:15:37','2025-12-18 20:29:17',NULL,NULL),(30,3,'Blaugurt',2,100,12,'#0066CC',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(31,3,'Lila Gurt',3,200,24,'#8A2BE2',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(32,3,'Braungurt',4,300,36,'#8B4513',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(33,3,'Schwarzgurt',5,500,60,'#000000',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(34,4,'Weißgurt',1,0,0,'#FFFFFF',NULL,1,'2025-08-25 05:16:09','2025-12-18 20:29:17','anfaenger',NULL),(35,4,'Gelbgurt',2,50,6,'#FFD700',NULL,1,'2025-08-25 05:16:09','2025-12-12 20:03:32','fortgeschritten',NULL),(47,5,'Weißgurt',1,0,3,'#FFFFFF',NULL,1,'2025-08-25 05:17:18','2025-12-18 20:29:17','grundstufe',NULL),(48,5,'Gelbgurt',3,40,3,'#FFD700',NULL,1,'2025-08-25 05:17:18','2025-12-14 05:39:56','grundstufe',NULL),(50,5,'Grüngurt',5,60,4,'#32CD32',NULL,1,'2025-08-25 05:17:18','2025-12-18 20:29:17','mittelstufe',NULL),(51,5,'Schwarzgurt',11,150,18,'#000000',NULL,1,'2025-08-25 05:17:18','2025-12-14 05:47:05','dan',NULL),(57,4,'Blaugurt',5,40,3,'#0066CC',NULL,1,'2025-08-27 05:15:08','2025-12-12 20:03:32',NULL,NULL),(58,4,'Orangegurt',3,40,3,'#FF8C00',NULL,1,'2025-08-27 18:22:28','2025-12-12 20:03:32','grundstufe',NULL),(61,7,'Rot-Schwarzgurt',6,40,3,'#DC143C','#000000',1,'2025-09-01 15:08:37','2025-09-05 06:39:09','oberstufe',NULL),(62,5,'Blau-Braungurt',8,40,6,'#0066CC','#8B4513',1,'2025-09-04 11:58:27','2025-12-14 05:21:42','oberstufe',NULL),(63,5,'Weiß-Gelbgurt',2,40,3,'#FFFFFF','#FFD700',1,'2025-09-07 08:52:43','2025-12-18 20:29:17','grundstufe',NULL),(64,5,'Blaugurt',7,40,4,'#0066CC',NULL,1,'2025-10-25 17:26:34','2025-12-14 05:21:42','mittelstufe',NULL),(65,5,'Rot-Schwarzgurt',9,40,6,'#DC143C','#000000',1,'2025-10-25 17:27:41','2025-12-14 05:47:04','dan',NULL),(67,5,'Gelb-Grüngurt',4,40,4,'#FFD700','#0A9913',1,'2025-11-08 09:54:56','2025-12-18 20:29:17','mittelstufe',NULL),(68,5,'Grün-Blaugurt',6,40,4,'#32CD32','#1C2DB0',1,'2025-11-08 10:40:17','2025-12-18 20:29:17','mittelstufe',NULL),(69,5,'Rotgurt',10,40,6,'#DC143C',NULL,1,'2025-12-08 15:35:48','2025-12-14 05:47:04','oberstufe',NULL),(70,4,'1.DAN Schwarzgurt',7,40,12,'#000000',NULL,1,'2025-12-08 15:42:21','2025-12-12 20:04:24','dan',1),(71,4,'Grüngurt',4,40,3,'#32CD32',NULL,1,'2025-12-12 20:03:15','2025-12-18 20:29:17','mittelstufe',NULL),(72,4,'Braungurt',6,40,3,'#8B4513',NULL,1,'2025-12-12 20:03:24','2025-12-12 20:03:32','oberstufe',NULL),(73,4,'2.DAN Schwarzgurt',8,40,3,'#000000',NULL,1,'2025-12-12 20:03:43','2025-12-12 20:03:43','dan',2),(74,4,'3.DAN Schwarzgurt',9,40,3,'#000000',NULL,1,'2025-12-12 20:03:51','2025-12-12 20:03:51','dan',3),(75,4,'4.DAN Schwarzgurt',10,40,3,'#000000',NULL,1,'2025-12-12 20:03:59','2025-12-12 20:03:59','dan',4),(76,4,'5.DAN Schwarzgurt',11,40,3,'#000000',NULL,1,'2025-12-12 20:04:05','2025-12-12 20:04:05','dan',5),(77,5,'2.DAN Schwarzgurt',12,40,24,'#000000',NULL,1,'2025-12-14 05:29:05','2025-12-14 05:29:05','dan',2);
/*!40000 ALTER TABLE `graduierungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gruppen`
--

DROP TABLE IF EXISTS `gruppen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gruppen` (
  `gruppen_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reihenfolge` int DEFAULT '0',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`gruppen_id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_gruppen_dojo_id` (`dojo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gruppen`
--

LOCK TABLES `gruppen` WRITE;
/*!40000 ALTER TABLE `gruppen` DISABLE KEYS */;
INSERT INTO `gruppen` VALUES (1,'Kinder 4-6 Jahre',3,1),(3,'Jugendliche 13-17',4,1),(4,'Erwachsene',2,1),(6,'Anfänger',0,1),(7,'Fortgeschrittene',2,1),(8,'Kinder 7-12 Jahre',3,1),(9,'Jugendlich ab 16 Jahren und Erwachsene',1,1),(10,'Family Training',0,1),(11,'Teens 8-16 Jahre',0,1);
/*!40000 ALTER TABLE `gruppen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gruppen_mitglieder`
--

DROP TABLE IF EXISTS `gruppen_mitglieder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gruppen_mitglieder` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gruppe_id` int DEFAULT NULL,
  `mitglied_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `gruppe_id` (`gruppe_id`),
  KEY `mitglied_id` (`mitglied_id`),
  CONSTRAINT `gruppen_mitglieder_ibfk_1` FOREIGN KEY (`gruppe_id`) REFERENCES `kurse` (`kurs_id`),
  CONSTRAINT `gruppen_mitglieder_ibfk_2` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gruppen_mitglieder`
--

LOCK TABLES `gruppen_mitglieder` WRITE;
/*!40000 ALTER TABLE `gruppen_mitglieder` DISABLE KEYS */;
/*!40000 ALTER TABLE `gruppen_mitglieder` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interessenten`
--

DROP TABLE IF EXISTS `interessenten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `interessenten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int NOT NULL COMMENT 'Interessiert an diesem Dojo',
  `vorname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nachname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `geburtsdatum` date DEFAULT NULL,
  `alter` int DEFAULT NULL COMMENT 'Alter des Interessenten',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon_mobil` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hausnummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `interessiert_an` text COLLATE utf8mb4_unicode_ci COMMENT 'Welche Kampfkunst/Programm interessiert den Prospect?',
  `erfahrung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Vorherige Kampfkunst-Erfahrung',
  `gewuenschter_tarif` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Gewünschter Tarif (falls angegeben)',
  `erstkontakt_datum` date DEFAULT NULL COMMENT 'Datum des ersten Kontakts',
  `erstkontakt_quelle` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Quelle: Website, Empfehlung, Facebook, etc.',
  `letzter_kontakt_datum` date DEFAULT NULL COMMENT 'Datum des letzten Kontakts',
  `naechster_kontakt_datum` date DEFAULT NULL COMMENT 'Geplanter nächster Kontakt',
  `status` enum('neu','kontaktiert','probetraining_vereinbart','probetraining_absolviert','angebot_gesendet','interessiert','nicht_interessiert','konvertiert') COLLATE utf8mb4_unicode_ci DEFAULT 'neu',
  `konvertiert_zu_mitglied_id` int DEFAULT NULL COMMENT 'Referenz zum Mitglied (falls konvertiert)',
  `konvertiert_am` date DEFAULT NULL COMMENT 'Datum der Konvertierung zum Mitglied',
  `probetraining_datum` date DEFAULT NULL COMMENT 'Datum des vereinbarten Probetrainings',
  `probetraining_absolviert` tinyint(1) DEFAULT '0',
  `probetraining_feedback` text COLLATE utf8mb4_unicode_ci COMMENT 'Feedback nach Probetraining',
  `notizen` text COLLATE utf8mb4_unicode_ci COMMENT 'Interne Notizen zum Interessenten',
  `newsletter_angemeldet` tinyint(1) DEFAULT '0',
  `datenschutz_akzeptiert` tinyint(1) DEFAULT '0',
  `datenschutz_akzeptiert_am` timestamp NULL DEFAULT NULL,
  `prioritaet` enum('niedrig','mittel','hoch') COLLATE utf8mb4_unicode_ci DEFAULT 'mittel',
  `zustaendig_user_id` int DEFAULT NULL COMMENT 'Zuständiger Mitarbeiter für Follow-up',
  `archiviert` tinyint(1) DEFAULT '0' COMMENT 'Nicht mehr aktiv verfolgen',
  `archiviert_grund` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Grund für Archivierung',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_interessenten_dojo` (`dojo_id`),
  KEY `idx_interessenten_name` (`nachname`,`vorname`),
  KEY `idx_interessenten_status` (`status`),
  KEY `idx_interessenten_email` (`email`),
  KEY `idx_interessenten_erstkontakt` (`erstkontakt_datum`),
  KEY `idx_interessenten_naechster_kontakt` (`naechster_kontakt_datum`),
  KEY `idx_interessenten_archiviert` (`archiviert`),
  KEY `idx_interessenten_prioritaet` (`prioritaet`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Interessenten und potenzielle Mitglieder';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interessenten`
--

LOCK TABLES `interessenten` WRITE;
/*!40000 ALTER TABLE `interessenten` DISABLE KEYS */;
/*!40000 ALTER TABLE `interessenten` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventar`
--

DROP TABLE IF EXISTS `inventar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kategorie` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zustand` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'neu',
  `standort` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventar`
--

LOCK TABLES `inventar` WRITE;
/*!40000 ALTER TABLE `inventar` DISABLE KEYS */;
INSERT INTO `inventar` VALUES (1,'Trainingsmatten Set','matten','neu','Dojo Hauptraum'),(2,'Boxsäcke','trainingsgeraet','neu','Dojo Hauptraum');
/*!40000 ALTER TABLE `inventar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kassenbuch`
--

DROP TABLE IF EXISTS `kassenbuch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kassenbuch` (
  `eintrag_id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int DEFAULT NULL,
  `geschaeft_datum` date NOT NULL,
  `eintrag_timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `bewegungsart` enum('einnahme','ausgabe','entnahme','einlage','tagesabschluss') COLLATE utf8mb4_unicode_ci NOT NULL,
  `betrag_cent` int NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `verkauf_id` int DEFAULT NULL,
  `beleg_nummer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kassenstand_vorher_cent` int NOT NULL,
  `kassenstand_nachher_cent` int NOT NULL,
  `erfasst_von` int DEFAULT NULL,
  `erfasst_von_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`eintrag_id`),
  KEY `verkauf_id` (`verkauf_id`),
  KEY `idx_datum` (`geschaeft_datum`),
  KEY `idx_bewegungsart` (`bewegungsart`),
  KEY `idx_dojo_id` (`dojo_id`),
  CONSTRAINT `kassenbuch_ibfk_1` FOREIGN KEY (`verkauf_id`) REFERENCES `verkaeufe` (`verkauf_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kassenbuch`
--

LOCK TABLES `kassenbuch` WRITE;
/*!40000 ALTER TABLE `kassenbuch` DISABLE KEYS */;
/*!40000 ALTER TABLE `kassenbuch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kurs_bewertungen`
--

DROP TABLE IF EXISTS `kurs_bewertungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kurs_bewertungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `kurs_id` int NOT NULL,
  `bewertung` int NOT NULL,
  `kommentar` text COLLATE utf8mb4_unicode_ci,
  `erstellt_am` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_member_course` (`mitglied_id`,`kurs_id`),
  KEY `kurs_id` (`kurs_id`),
  CONSTRAINT `kurs_bewertungen_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`),
  CONSTRAINT `kurs_bewertungen_ibfk_2` FOREIGN KEY (`kurs_id`) REFERENCES `kurse` (`kurs_id`),
  CONSTRAINT `kurs_bewertungen_chk_1` CHECK ((`bewertung` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kurs_bewertungen`
--

LOCK TABLES `kurs_bewertungen` WRITE;
/*!40000 ALTER TABLE `kurs_bewertungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `kurs_bewertungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kurse`
--

DROP TABLE IF EXISTS `kurse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kurse` (
  `kurs_id` int NOT NULL AUTO_INCREMENT,
  `gruppenname` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stil` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trainer_id` int DEFAULT NULL,
  `trainer_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `raum_id` int DEFAULT NULL,
  `trainingszeit` time DEFAULT NULL,
  `beginn` time DEFAULT NULL,
  `ende` time DEFAULT NULL,
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  `standort_id` int DEFAULT NULL,
  PRIMARY KEY (`kurs_id`),
  KEY `trainer_id` (`trainer_id`),
  KEY `idx_kurse_dojo_id` (`dojo_id`),
  KEY `raum_id` (`raum_id`),
  KEY `idx_kurse_standort_id` (`standort_id`),
  CONSTRAINT `fk_kurse_standort` FOREIGN KEY (`standort_id`) REFERENCES `standorte` (`standort_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `kurse_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `trainer` (`trainer_id`),
  CONSTRAINT `kurse_ibfk_2` FOREIGN KEY (`raum_id`) REFERENCES `raeume` (`id`) ON DELETE SET NULL,
  CONSTRAINT `kurse_chk_1` CHECK (json_valid(`trainer_ids`))
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kurse`
--

LOCK TABLES `kurse` WRITE;
/*!40000 ALTER TABLE `kurse` DISABLE KEYS */;
INSERT INTO `kurse` VALUES (16,'Kinder 4-6 Jahre','Enso Karate',NULL,'[2]',1,NULL,NULL,NULL,3,2),(17,'Anfänger','Enso Karate',NULL,'[2]',1,NULL,NULL,NULL,3,2),(18,'Jugendlich ab 16 Jahren und Erwachsene','Kickboxen',NULL,'[2]',1,NULL,NULL,NULL,3,2),(19,'Family Training','Enso Karate',NULL,'[4]',1,NULL,NULL,NULL,3,2),(20,'Fortgeschrittene','Enso Karate',NULL,'[2]',1,NULL,NULL,NULL,3,2),(21,'Erwachsene','ShieldX',NULL,'[2]',1,NULL,NULL,NULL,3,2),(22,'Kinder 4-6 Jahre','Kickboxen',NULL,'[2]',1,NULL,NULL,NULL,3,2),(23,'Kinder 7-12 Jahre','Kickboxen',NULL,'[2]',1,NULL,NULL,NULL,3,2),(24,'Teens 8-16 Jahre','Enso Karate',NULL,'[2]',1,NULL,NULL,NULL,3,2),(25,'Kinder 7-12 Jahre','ShieldX',NULL,'[3]',1,NULL,NULL,NULL,3,2),(26,'Jugendlich ab 16 Jahren und Erwachsene','Brazilian Jiu Jitsu',NULL,'[3]',1,NULL,NULL,NULL,3,2),(27,'Jugendlich ab 16 Jahren und Erwachsene','Kickboxen',NULL,'[3]',1,NULL,NULL,NULL,3,2),(28,'Jugendlich ab 16 Jahren und Erwachsene','Enso Karate',NULL,'[2]',1,NULL,NULL,NULL,3,2);
/*!40000 ALTER TABLE `kurse` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lager_bewegungen`
--

DROP TABLE IF EXISTS `lager_bewegungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lager_bewegungen` (
  `bewegung_id` int NOT NULL AUTO_INCREMENT,
  `artikel_id` int NOT NULL,
  `bewegungsart` enum('eingang','ausgang','korrektur','inventur') COLLATE utf8mb4_unicode_ci NOT NULL,
  `menge` int NOT NULL,
  `alter_bestand` int NOT NULL,
  `neuer_bestand` int NOT NULL,
  `grund` text COLLATE utf8mb4_unicode_ci,
  `verkauf_id` int DEFAULT NULL,
  `durchgefuehrt_von` int DEFAULT NULL,
  `durchgefuehrt_von_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bewegung_timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`bewegung_id`),
  KEY `verkauf_id` (`verkauf_id`),
  KEY `idx_artikel` (`artikel_id`),
  KEY `idx_timestamp` (`bewegung_timestamp`),
  KEY `idx_bewegungsart` (`bewegungsart`),
  CONSTRAINT `lager_bewegungen_ibfk_1` FOREIGN KEY (`artikel_id`) REFERENCES `artikel` (`artikel_id`) ON DELETE CASCADE,
  CONSTRAINT `lager_bewegungen_ibfk_2` FOREIGN KEY (`verkauf_id`) REFERENCES `verkaeufe` (`verkauf_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lager_bewegungen`
--

LOCK TABLES `lager_bewegungen` WRITE;
/*!40000 ALTER TABLE `lager_bewegungen` DISABLE KEYS */;
INSERT INTO `lager_bewegungen` VALUES (1,1,'ausgang',-38,50,12,'Manuelle Bestandskorrektur: 50 → 12',NULL,NULL,NULL,'2025-12-17 09:46:35');
/*!40000 ALTER TABLE `lager_bewegungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `laufzeiten`
--

DROP TABLE IF EXISTS `laufzeiten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `laufzeiten` (
  `laufzeit_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `monate` int NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `aktiv` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`laufzeit_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `laufzeiten`
--

LOCK TABLES `laufzeiten` WRITE;
/*!40000 ALTER TABLE `laufzeiten` DISABLE KEYS */;
INSERT INTO `laufzeiten` VALUES (1,'1 Monat',1,'Kurze Laufzeit - 1 Monat',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(2,'3 Monate',3,'Mittlere Laufzeit - 3 Monate',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(3,'6 Monate',6,'Längere Laufzeit - 6 Monate',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(4,'12 Monate',12,'Jahresvertrag - 12 Monate',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(5,'24 Monate',24,'Zweijahresvertrag - 24 Monate',1,'2025-10-05 07:01:21','2025-10-05 07:01:21');
/*!40000 ALTER TABLE `laufzeiten` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mahnstufen_einstellungen`
--

DROP TABLE IF EXISTS `mahnstufen_einstellungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mahnstufen_einstellungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stufe` int NOT NULL,
  `bezeichnung` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tage_nach_faelligkeit` int NOT NULL DEFAULT '14',
  `mahngebuehr` decimal(10,2) DEFAULT '0.00',
  `email_betreff` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_text` text COLLATE utf8mb4_unicode_ci,
  `aktiv` tinyint(1) DEFAULT '1',
  `dojo_id` int DEFAULT '1',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_stufe_dojo` (`stufe`,`dojo_id`),
  KEY `idx_stufe` (`stufe`),
  KEY `idx_dojo` (`dojo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mahnstufen_einstellungen`
--

LOCK TABLES `mahnstufen_einstellungen` WRITE;
/*!40000 ALTER TABLE `mahnstufen_einstellungen` DISABLE KEYS */;
INSERT INTO `mahnstufen_einstellungen` VALUES (7,1,'1. Mahnung (Zahlungserinnerung)',14,5.00,'Zahlungserinnerung - Offener Beitrag','Sehr geehrte/r {vorname} {nachname},\n\nwir möchten Sie freundlich daran erinnern, dass folgender Beitrag noch offen ist:\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\n\nBitte überweisen Sie den Betrag zeitnah auf unser Konto.\n\nMit freundlichen Grüßen\nIhr Dojo-Team',1,1,'2025-11-06 13:59:07','2025-11-06 13:59:07'),(8,2,'2. Mahnung (Erste Mahnung)',28,10.00,'2. Mahnung - Dringend: Offener Beitrag','Sehr geehrte/r {vorname} {nachname},\n\nleider haben wir bisher keine Zahlung erhalten. Dies ist Ihre 2. Mahnung.\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\nMahngebühr: {mahngebuehr} €\nGesamtbetrag: {gesamtbetrag} €\n\nBitte begleichen Sie den Betrag umgehend.\n\nMit freundlichen Grüßen\nIhr Dojo-Team',1,1,'2025-11-06 13:59:07','2025-11-06 13:59:07'),(9,3,'3. Mahnung (Letzte Mahnung)',42,15.00,'3. Mahnung - LETZTE ZAHLUNGSAUFFORDERUNG','Sehr geehrte/r {vorname} {nachname},\n\ntrotz mehrfacher Aufforderung ist der fällige Betrag noch nicht eingegangen. Dies ist unsere letzte Mahnung vor rechtlichen Schritten.\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\nMahngebühr: {mahngebuehr} €\nGesamtbetrag: {gesamtbetrag} €\n\nBitte zahlen Sie SOFORT, um weitere Maßnahmen zu vermeiden.\n\nMit freundlichen Grüßen\nIhr Dojo-Team',1,1,'2025-11-06 13:59:07','2025-11-06 13:59:07');
/*!40000 ALTER TABLE `mahnstufen_einstellungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mahnungen`
--

DROP TABLE IF EXISTS `mahnungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mahnungen` (
  `mahnung_id` int NOT NULL AUTO_INCREMENT,
  `beitrag_id` int NOT NULL,
  `mahnstufe` int NOT NULL DEFAULT '1',
  `mahndatum` date NOT NULL,
  `mahngebuehr` decimal(10,2) DEFAULT '0.00',
  `versandt` tinyint(1) DEFAULT '0',
  `versand_art` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'email',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mahnung_id`),
  KEY `idx_beitrag` (`beitrag_id`),
  KEY `idx_mahnstufe` (`mahnstufe`),
  KEY `idx_versandt` (`versandt`),
  CONSTRAINT `mahnungen_ibfk_1` FOREIGN KEY (`beitrag_id`) REFERENCES `beitraege` (`beitrag_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mahnungen`
--

LOCK TABLES `mahnungen` WRITE;
/*!40000 ALTER TABLE `mahnungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `mahnungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglied_dokumente`
--

DROP TABLE IF EXISTS `mitglied_dokumente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglied_dokumente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `dojo_id` int NOT NULL,
  `vorlage_id` int NOT NULL,
  `dokumentname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dateipfad` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `erstellt_von` int DEFAULT NULL COMMENT 'User-ID des Admins',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vorlage_id` (`vorlage_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_dojo` (`dojo_id`),
  KEY `idx_erstellt` (`erstellt_am`),
  CONSTRAINT `mitglied_dokumente_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `mitglied_dokumente_ibfk_2` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mitglied_dokumente_ibfk_3` FOREIGN KEY (`vorlage_id`) REFERENCES `vertragsvorlagen` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglied_dokumente`
--

LOCK TABLES `mitglied_dokumente` WRITE;
/*!40000 ALTER TABLE `mitglied_dokumente` DISABLE KEYS */;
/*!40000 ALTER TABLE `mitglied_dokumente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglied_stil_data`
--

DROP TABLE IF EXISTS `mitglied_stil_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglied_stil_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `stil_id` int NOT NULL,
  `current_graduierung_id` int DEFAULT NULL,
  `letzte_pruefung` date DEFAULT NULL,
  `naechste_pruefung` date DEFAULT NULL,
  `anmerkungen` text COLLATE utf8mb4_unicode_ci,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mitglied_stil` (`mitglied_id`,`stil_id`),
  KEY `stil_id` (`stil_id`),
  KEY `current_graduierung_id` (`current_graduierung_id`),
  CONSTRAINT `mitglied_stil_data_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`),
  CONSTRAINT `mitglied_stil_data_ibfk_2` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`),
  CONSTRAINT `mitglied_stil_data_ibfk_3` FOREIGN KEY (`current_graduierung_id`) REFERENCES `graduierungen` (`graduierung_id`)
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglied_stil_data`
--

LOCK TABLES `mitglied_stil_data` WRITE;
/*!40000 ALTER TABLE `mitglied_stil_data` DISABLE KEYS */;
INSERT INTO `mitglied_stil_data` VALUES (1,76,4,34,NULL,NULL,NULL,'2025-12-04 15:17:04','2025-12-04 15:22:51'),(3,74,5,63,'2025-12-15',NULL,NULL,'2025-12-05 16:37:33','2025-12-15 07:08:14'),(5,64,4,34,NULL,NULL,NULL,'2025-12-05 19:33:52','2025-12-05 19:33:52'),(6,120,5,64,NULL,NULL,NULL,'2025-12-07 21:50:22','2025-12-07 21:50:29'),(7,164,5,67,NULL,NULL,NULL,'2025-12-08 15:23:25','2025-12-08 15:23:29'),(8,185,5,67,NULL,NULL,NULL,'2025-12-08 15:23:47','2025-12-08 15:23:50'),(9,109,5,64,NULL,NULL,NULL,'2025-12-08 15:28:38','2025-12-08 15:28:41'),(10,111,5,69,NULL,NULL,NULL,'2025-12-08 15:29:00','2025-12-08 15:36:09'),(11,112,5,64,NULL,NULL,NULL,'2025-12-08 15:38:11','2025-12-08 15:38:15'),(12,99,5,63,'2025-12-15',NULL,NULL,'2025-12-08 15:38:31','2025-12-15 20:36:03'),(13,68,5,63,'2025-12-15',NULL,NULL,'2025-12-08 15:39:02','2025-12-15 20:35:41'),(15,169,5,68,NULL,NULL,NULL,'2025-12-08 15:40:39','2025-12-08 15:40:42'),(16,78,5,63,'2025-12-15',NULL,NULL,'2025-12-08 15:40:56','2025-12-15 20:35:53'),(18,1,5,64,NULL,NULL,NULL,'2025-12-08 15:41:25','2025-12-08 15:41:27'),(23,138,4,70,NULL,NULL,NULL,'2025-12-08 15:41:48','2025-12-08 15:42:42'),(24,138,5,47,NULL,NULL,NULL,'2025-12-08 15:41:48','2025-12-08 15:41:48'),(25,138,2,NULL,NULL,NULL,NULL,'2025-12-08 15:41:48','2025-12-08 15:41:48'),(26,116,5,68,NULL,NULL,NULL,'2025-12-08 15:43:27','2025-12-08 15:43:31'),(27,93,5,63,NULL,NULL,NULL,'2025-12-09 21:40:04','2025-12-09 21:40:05'),(28,149,5,63,NULL,NULL,NULL,'2025-12-09 21:40:35','2025-12-09 21:40:38'),(29,170,5,63,NULL,NULL,NULL,'2025-12-09 21:41:03','2025-12-09 21:41:06'),(30,143,4,34,NULL,NULL,NULL,'2025-12-09 21:41:27','2025-12-09 21:41:27'),(32,146,4,34,NULL,NULL,NULL,'2025-12-09 21:41:49','2025-12-09 21:41:49'),(33,146,2,NULL,NULL,NULL,NULL,'2025-12-09 21:41:49','2025-12-09 21:41:49'),(34,173,4,34,NULL,NULL,NULL,'2025-12-09 21:42:13','2025-12-09 21:42:13'),(35,83,5,47,NULL,NULL,NULL,'2025-12-09 21:42:43','2025-12-09 21:42:43'),(36,69,4,34,NULL,NULL,NULL,'2025-12-09 21:42:58','2025-12-09 21:42:58'),(37,148,4,34,NULL,NULL,NULL,'2025-12-10 07:37:52','2025-12-10 07:37:52'),(38,140,4,34,NULL,NULL,NULL,'2025-12-10 07:38:09','2025-12-10 07:38:09'),(40,189,4,34,NULL,NULL,NULL,'2025-12-10 07:38:24','2025-12-10 07:38:24'),(41,189,2,NULL,NULL,NULL,NULL,'2025-12-10 07:38:24','2025-12-10 07:38:24'),(42,96,2,NULL,NULL,NULL,NULL,'2025-12-10 07:38:37','2025-12-10 07:38:37'),(43,87,4,34,NULL,NULL,NULL,'2025-12-10 07:38:50','2025-12-10 07:38:50'),(44,77,5,47,NULL,NULL,NULL,'2025-12-10 07:39:03','2025-12-10 07:39:03'),(45,174,4,34,NULL,NULL,NULL,'2025-12-10 07:39:36','2025-12-10 07:39:36'),(47,179,4,34,NULL,NULL,NULL,'2025-12-10 07:39:55','2025-12-10 07:39:55'),(48,179,2,NULL,NULL,NULL,NULL,'2025-12-10 07:39:55','2025-12-10 07:39:55'),(52,80,4,34,NULL,NULL,NULL,'2025-12-10 07:40:12','2025-12-10 07:40:12'),(53,80,5,47,NULL,NULL,NULL,'2025-12-10 07:40:12','2025-12-10 07:40:12'),(54,80,2,NULL,NULL,NULL,NULL,'2025-12-10 07:40:12','2025-12-10 07:40:12'),(55,113,4,34,NULL,NULL,NULL,'2025-12-10 07:40:28','2025-12-10 07:40:28'),(56,118,5,47,NULL,NULL,NULL,'2025-12-10 07:40:49','2025-12-10 07:40:49'),(57,118,4,34,NULL,NULL,NULL,'2025-12-10 07:40:49','2025-12-10 07:40:49'),(59,152,4,34,NULL,NULL,NULL,'2025-12-10 07:41:11','2025-12-10 07:41:11'),(60,152,2,NULL,NULL,NULL,NULL,'2025-12-10 07:41:11','2025-12-10 07:41:11'),(61,172,4,34,NULL,NULL,NULL,'2025-12-10 07:41:41','2025-12-10 07:41:41'),(62,89,4,34,NULL,NULL,NULL,'2025-12-10 07:42:48','2025-12-10 07:42:48'),(63,90,4,34,NULL,NULL,NULL,'2025-12-10 07:43:13','2025-12-10 07:43:13'),(64,65,4,34,NULL,NULL,NULL,'2025-12-10 07:43:34','2025-12-10 07:43:34'),(66,117,4,34,NULL,NULL,NULL,'2025-12-10 08:56:59','2025-12-10 08:56:59'),(67,117,2,NULL,NULL,NULL,NULL,'2025-12-10 08:56:59','2025-12-10 08:56:59'),(68,84,5,63,'2025-12-15',NULL,NULL,'2025-12-10 08:57:44','2025-12-15 20:36:12'),(70,79,5,47,NULL,NULL,NULL,'2025-12-10 08:58:07','2025-12-10 08:58:07'),(71,79,4,34,NULL,NULL,NULL,'2025-12-10 08:58:07','2025-12-10 08:58:07'),(73,134,4,34,NULL,NULL,NULL,'2025-12-10 08:58:31','2025-12-10 08:58:31'),(74,134,2,NULL,NULL,NULL,NULL,'2025-12-10 08:58:31','2025-12-10 08:58:31'),(76,81,4,34,NULL,NULL,NULL,'2025-12-10 08:58:48','2025-12-10 08:58:48'),(77,81,2,NULL,NULL,NULL,NULL,'2025-12-10 08:58:48','2025-12-10 08:58:48'),(79,97,4,34,NULL,NULL,NULL,'2025-12-10 08:59:11','2025-12-10 08:59:11'),(80,97,5,47,NULL,NULL,NULL,'2025-12-10 08:59:11','2025-12-10 08:59:11'),(82,153,4,34,NULL,NULL,NULL,'2025-12-10 08:59:29','2025-12-10 08:59:29'),(83,153,2,NULL,NULL,NULL,NULL,'2025-12-10 08:59:29','2025-12-10 08:59:29'),(89,72,4,34,NULL,NULL,NULL,'2025-12-16 08:01:29','2025-12-16 08:01:29'),(90,75,4,34,NULL,NULL,NULL,'2025-12-19 06:06:19','2025-12-19 06:06:19');
/*!40000 ALTER TABLE `mitglied_stil_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglied_stile`
--

DROP TABLE IF EXISTS `mitglied_stile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglied_stile` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `stil` enum('Kickboxen','Karate','Enso Karate','Taekwon-Do','ShieldX','BJJ','Brazilian Jiu Jitsu') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `mitglied_id` (`mitglied_id`),
  CONSTRAINT `mitglied_stile_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=87 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglied_stile`
--

LOCK TABLES `mitglied_stile` WRITE;
/*!40000 ALTER TABLE `mitglied_stile` DISABLE KEYS */;
INSERT INTO `mitglied_stile` VALUES (2,76,'Kickboxen'),(4,74,'Enso Karate'),(6,64,'Kickboxen'),(7,120,'Enso Karate'),(8,164,'Enso Karate'),(9,185,'Enso Karate'),(10,109,'Enso Karate'),(11,111,'Enso Karate'),(12,112,'Enso Karate'),(13,99,'Enso Karate'),(14,68,'Enso Karate'),(16,169,'Enso Karate'),(17,78,'Enso Karate'),(19,1,'Enso Karate'),(24,138,'Kickboxen'),(25,138,'Enso Karate'),(26,138,'ShieldX'),(27,116,'Enso Karate'),(28,93,'Enso Karate'),(29,149,'Enso Karate'),(30,170,'Enso Karate'),(31,143,'Kickboxen'),(33,146,'Kickboxen'),(34,146,'ShieldX'),(35,173,'Kickboxen'),(36,83,'Enso Karate'),(37,69,'Kickboxen'),(38,148,'Kickboxen'),(39,140,'Kickboxen'),(41,189,'Kickboxen'),(42,189,'ShieldX'),(43,96,'ShieldX'),(44,87,'Kickboxen'),(45,77,'Enso Karate'),(46,174,'Kickboxen'),(48,179,'Kickboxen'),(49,179,'ShieldX'),(53,80,'Kickboxen'),(54,80,'Enso Karate'),(55,80,'ShieldX'),(56,113,'Kickboxen'),(57,118,'Enso Karate'),(58,118,'Kickboxen'),(60,152,'Kickboxen'),(61,152,'ShieldX'),(62,172,'Kickboxen'),(63,89,'Kickboxen'),(64,90,'Kickboxen'),(65,65,'Kickboxen'),(67,117,'Kickboxen'),(68,117,'ShieldX'),(69,84,'Enso Karate'),(71,79,'Enso Karate'),(72,79,'Kickboxen'),(74,134,'Kickboxen'),(75,134,'ShieldX'),(77,81,'Kickboxen'),(78,81,'ShieldX'),(80,97,'Kickboxen'),(81,97,'Enso Karate'),(83,153,'Kickboxen'),(84,153,'ShieldX'),(85,72,'Kickboxen'),(86,75,'Kickboxen');
/*!40000 ALTER TABLE `mitglied_stile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglieder`
--

DROP TABLE IF EXISTS `mitglieder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglieder` (
  `mitglied_id` int NOT NULL AUTO_INCREMENT,
  `vorname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nachname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geburtsdatum` date NOT NULL,
  `geschlecht` enum('m','w','d') COLLATE utf8mb4_unicode_ci NOT NULL,
  `schueler_student` tinyint(1) DEFAULT '0' COMMENT 'Schüler/Student über 18 Jahre',
  `gewicht` decimal(5,2) DEFAULT NULL,
  `groesse` decimal(5,2) DEFAULT NULL COMMENT 'GrÃ¶ÃŸe in cm',
  `gurtfarbe` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stil_id` int DEFAULT NULL COMMENT 'Aktueller Kampfkunst-Stil',
  `graduierung_id` int DEFAULT NULL COMMENT 'Aktuelle Graduierung/Gürtel',
  `graduierung_datum` date DEFAULT NULL COMMENT 'Datum der letzten Graduierung',
  `naechste_pruefung` date DEFAULT NULL COMMENT 'Geplantes Datum für nächste Prüfung',
  `telefon_mobil` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strasse` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hausnummer` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ort` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `land` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Deutschland',
  `iban` varchar(34) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bic` varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bankname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kontoinhaber` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zahlungsmethode` enum('Lastschrift','Bar','Überweisung') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Lastschrift',
  `zahllaufgruppe` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `eintrittsdatum` date NOT NULL DEFAULT (curdate()),
  `beigetreten_am` date DEFAULT NULL,
  `gekuendigt_am` date DEFAULT NULL,
  `aktiv` tinyint(1) DEFAULT '1',
  `notfallkontakt_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt_telefon` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allergien` text COLLATE utf8mb4_unicode_ci,
  `foto_einverstaendnis` tinyint(1) DEFAULT '0',
  `medizinische_hinweise` text COLLATE utf8mb4_unicode_ci,
  `notfallkontakt_verhaeltnis` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `naechste_pruefung_datum` date DEFAULT NULL,
  `pruefungsgebuehr_bezahlt` tinyint(1) DEFAULT '0',
  `trainer_empfehlung` text COLLATE utf8mb4_unicode_ci,
  `hausordnung_akzeptiert` tinyint(1) DEFAULT '0',
  `datenschutz_akzeptiert` tinyint(1) DEFAULT '0',
  `vereinsordnung_datum` date DEFAULT NULL,
  `familien_id` int DEFAULT NULL,
  `rabatt_prozent` decimal(5,2) DEFAULT NULL,
  `rabatt_grund` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt2_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt2_telefon` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt2_verhaeltnis` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt3_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt3_telefon` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notfallkontakt3_verhaeltnis` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci,
  `letzter_login` timestamp NULL DEFAULT NULL,
  `newsletter_abo` tinyint(1) DEFAULT '1',
  `marketing_quelle` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `online_portal_aktiv` tinyint(1) DEFAULT '0',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  `trainingsstunden` decimal(10,2) DEFAULT '0.00',
  `foto_pfad` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pfad zum Mitgliedsfoto',
  `geworben_von_mitglied_id` int DEFAULT NULL,
  `agb_akzeptiert` tinyint(1) DEFAULT '0' COMMENT 'AGB akzeptiert (Kopie aus Vertrag f├╝r Auswertungen)',
  `agb_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Zeitpunkt der AGB-Akzeptanz',
  `haftungsausschluss_akzeptiert` tinyint(1) DEFAULT '0' COMMENT 'Haftungsausschluss akzeptiert',
  `haftungsausschluss_datum` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Haftungsausschluss-Akzeptanz',
  `gesundheitserklaerung` tinyint(1) DEFAULT '0' COMMENT 'Gesundheitserkl├ñrung abgegeben',
  `gesundheitserklaerung_datum` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Gesundheitserkl├ñrung',
  `hausordnung_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Hausordnungs-Akzeptanz',
  `datenschutz_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Datenschutz-Akzeptanz',
  `foto_einverstaendnis_datum` datetime DEFAULT NULL COMMENT 'Zeitpunkt des Foto-Einverst├ñndnisses',
  `vertragsfrei` tinyint(1) DEFAULT '0' COMMENT 'Mitglied ist von Vertragspflicht befreit (Ehrenmitglied, Familie, etc.)',
  `vertragsfrei_grund` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Grund fÃ¼r die Vertragsfreistellung',
  `magicline_customer_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MagicLine Kundennummer (z.B. M-5)',
  `magicline_uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MagicLine UUID fÃ¼r eindeutige Zuordnung',
  PRIMARY KEY (`mitglied_id`),
  KEY `idx_mitglied_stil` (`stil_id`),
  KEY `idx_mitglied_graduierung` (`graduierung_id`),
  KEY `idx_mitglieder_aktiv` (`aktiv`),
  KEY `idx_mitglieder_name` (`nachname`,`vorname`),
  KEY `idx_mitglieder_dojo_id` (`dojo_id`),
  KEY `idx_mitglieder_foto` (`foto_pfad`),
  KEY `idx_mitglieder_geworben_von` (`geworben_von_mitglied_id`),
  KEY `idx_vertragsfrei` (`vertragsfrei`),
  KEY `idx_magicline_customer_number` (`magicline_customer_number`),
  KEY `idx_magicline_uuid` (`magicline_uuid`),
  CONSTRAINT `fk_mitglied_graduierung` FOREIGN KEY (`graduierung_id`) REFERENCES `graduierungen` (`graduierung_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mitglied_stil` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=190 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglieder`
--

LOCK TABLES `mitglieder` WRITE;
/*!40000 ALTER TABLE `mitglieder` DISABLE KEYS */;
INSERT INTO `mitglieder` VALUES (1,'Sam','Schreiner','2016-08-06','m',0,NULL,NULL,NULL,'headquarter@tda-intl.com','04915752461776',NULL,NULL,NULL,NULL,'04915752461776','Geigelsteinstr.','14','84137','Vilsbiburg','Deutschland','dsfsd','dfsf','dfs','sdfs','Lastschrift',NULL,'2025-11-28','2025-11-28',NULL,1,'','','',1,'','',NULL,0,NULL,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,1,'2025-11-28 08:53:22',1,'2025-11-28 08:53:22',1,'2025-11-28 08:53:22','2025-11-28 08:53:22','2025-11-28 08:53:22','2025-11-28 08:53:22',1,'Familie',NULL,NULL),(64,'Rafael','Barnert','2013-02-09','m',0,NULL,NULL,NULL,'alexusteffi.barnert@googlemail.com','0160 95687396',NULL,NULL,NULL,NULL,'0160 95687396','Sonnenweg','3','84546','Egglkofen','Deutschland','DE20743500000003075826','BYLADEM1LAH','Sparkasse Landshut','Stefanie Barnert','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-12','4ca6afe3-aca3-4aa7-ab65-53d7773f4edd'),(65,'Korbinian','Sax','2015-06-15','m',0,NULL,NULL,NULL,'anita.sax83@gmail.com','016097701280',NULL,NULL,NULL,NULL,'016097701280','Gartenstr.','26a','84546','Egglkofen','Deutschland','DE54711510200000878512','BYLADEM1MDF','Sparkasse Altötting-Mühldorf','Tobias Sax','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-13','3ab12903-e9f0-4b73-bdfa-9d225d2a5e79'),(68,'Matteo','Krämer','2020-05-16','m',0,NULL,NULL,NULL,'philipp-fatemeh@web.de','01704579413',NULL,63,NULL,NULL,'01704579413','Falkensteinstr.','2','84137','Vilsbiburg','Deutschland','DE30743500000003054209','BYLADEM1LAH','Sparkasse Landshut','Philipp Kraemer','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,4.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-16','f74a403f-94f9-4888-ac77-0e7017b1d9e7'),(69,'Dominic','Purtan','2015-12-22','m',0,NULL,NULL,NULL,'gogu_hq@yahoo.com','(0176) 552-28358',NULL,NULL,NULL,NULL,'(0176) 552-28358','Brunnad','15','84175','Gerzen','Deutschland','DE33743923000003245047','GENODEF1VBV','VR-Bank Isar-Vils','George Purtan','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-17','6e41019f-6830-41ae-b7c3-d479f0aca092'),(71,'Lisa','Liebermann','2000-08-15','w',0,NULL,NULL,NULL,'lliebermann10@gmail.com','01757144894',NULL,NULL,NULL,NULL,'01757144894','Mühldorferstr.',NULL,'84539','Ampfing','Deutschland','DE74711510200031972375','BYLADEM1MDF','Sparkasse Altötting-Mühldorf','Lisa Liebermann','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-19','9cf556fa-3560-4211-aba8-e292413b305a'),(72,'Vlad','Turlea','2014-03-22','m',0,NULL,NULL,NULL,'bogdan.turlea.22@gmail.com','015166331414',NULL,NULL,NULL,NULL,'015166331414','Schlossfeld','24','84175','Gerzen','Deutschland','DE29700934000000236691','GENODEF1ISV','VR-Bank Ismaning Hallbergmoos Neufahrn','Bogdan Turlea','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-20','47658a31-d6ff-4a84-8b47-68486c60cd99'),(74,'Georg','Klinner','2017-02-26','m',0,NULL,NULL,NULL,'Ankeklinner@web.de','015770873101',NULL,63,NULL,NULL,'015770873101','Treidlkofen','28','84155','Bodenkirchen','Deutschland','DE43701695660000421359','GENODEF1TAV','VR-Bank Taufkirchen-Dorfen','Anke Klinner','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.25,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-22','7397831b-0f90-46f9-ba7a-89277198d995'),(75,'Niko','Bauer','2020-12-24','m',0,NULL,NULL,NULL,'tobias.bauer210@web.de','(0171) 2697217',NULL,NULL,NULL,NULL,'(0171) 2697217','Mailing','29','84140','Gangkofen','Deutschland','DE30500240243952731601','DEFFDEFFXXX','C24 Bank','Tobias Bauer','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-23','d5605fff-72db-47ab-9543-f252e2664de8'),(76,'Maximilian','Beer','2010-09-18','m',0,NULL,NULL,NULL,'rainerbeer79@gmail.com','(0170) 4759207',NULL,NULL,NULL,NULL,'(0170) 4759207','Sarling','6','84494','Niederbergkirchen','Deutschland','DE93740618130000317772','GENODEF1PFK','VR-Bank Rottal-Inn','Rainer Beer','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-24','747cccae-877b-40cb-a1e8-22bee0cab3ca'),(77,'Robin','Obermaier','2017-08-01','m',0,NULL,NULL,NULL,'AlexandraObermaier@t-online.de','01743843005',NULL,NULL,NULL,NULL,'01743843005','Brückenstr.','1','84175','Gerzen','Deutschland','DE49743500000004150937','BYLADEM1LAH','Sparkasse Landshut','Alexandra Obermaier','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-25','ead9d7db-41ac-4346-bda7-e29c32979227'),(78,'Thoyyiba','Noufal','2019-01-02','w',0,NULL,NULL,NULL,'noufalthangalr@gmail.com','017627473552',NULL,63,NULL,NULL,'017627473552','Veldenerstr.','7','84137','Vilsbiburg','Deutschland','DE02743923000000077682','GENODEF1VBV','VR-Bank Isar-Vils','Rahim Noufal','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,3.50,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-26','9cf5f6ec-3ae0-41e7-ab62-6c78f09d1016'),(79,'Benedikt','Lechner','2008-07-30','m',0,NULL,NULL,NULL,'benediktlechner@t-online.de','(+49) 151-59858770',NULL,NULL,NULL,NULL,'(+49) 151-59858770','Prof-Hasl-Straße','100a','84144','Geisenhausen','Deutschland','DE16743500000003369129','BYLADEM1LAH','Sparkasse Landshut','Tanja Lechner','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-27','6b173cfa-691f-48c3-b9c7-0999dbf1c212'),(80,'Dustin','Feucht','2002-08-10','m',0,NULL,NULL,NULL,'feuchtdustin@gmail.com','(0176) 747-87870',NULL,NULL,NULL,NULL,'(0176) 747-87870','Amselstr','13','84137','Vilsbiburg','Deutschland','DE78500105175450012564','INGDDEFFXXX','ING-DiBa','Dustin Feucht','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.75,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-28','69602fed-1d46-4c4a-8a15-c6ccea1a307f'),(81,'Franz Josef','Eidner','1991-02-28','m',0,NULL,NULL,NULL,'franzeidner@gmail.com','(01514) 075-9493',NULL,NULL,NULL,NULL,'(01514) 075-9493','Frontenhausener Straße','27','84137','Vilsbiburg','Deutschland','DE84743923000003241025','GENODEF1VBV','VR-Bank Isar-Vils','Franz Josef Eidner','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,3.50,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-29','36b2c278-b390-405f-af53-830129fe5f4a'),(83,'Jakob','Demberger','2018-05-28','m',0,NULL,NULL,NULL,'stefanie.demberger@gmx.de','(0160) 624-5547',NULL,NULL,NULL,NULL,'(0160) 624-5547','Föhrenstr','7','84513','Erharting','Deutschland','DE55711510200031306715','BYLADEM1MDF','Sparkasse Altötting-Mühldorf','Stefanie Demberger','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-30','7792d2f6-898b-49b6-885e-05c73f954e74'),(84,'Leon','Stauder','2017-08-06','m',0,NULL,NULL,NULL,'stauderfabio@gmail.com','(0171) 659-8120',NULL,63,NULL,NULL,'(0171) 659-8120','Canevastr','4','84494','Neumarkt St. Veit','Deutschland','DE04711600000007176139','GENODEF1VRR','meine Volksbank Raiffeisenbank','Fabio Stauder','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-31','14735abd-8e3a-4b73-8719-3d9428342eed'),(87,'Sebastian','Kaltwasser','1998-01-01','m',0,NULL,NULL,NULL,'Kaltiwork@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,'Unterbachham','2a','84140','Gangkofen','Deutschland','DE37740618130002619814','GENODEF1PFK','VR-Bank Rottal-Inn','Sebastian Kaltwasser','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-5','9db481d5-f6a2-4b42-8046-463418ff403b'),(88,'Dominik','Holzner','2003-07-30','m',0,NULL,NULL,NULL,'dominik@holzner.de','+49 1523 2065708',NULL,NULL,NULL,NULL,'+49 1523 2065708','Dorfstr.','3a','84155','Bodenkirchen','Deutschland','DE93743923000000804320','GENODEF1VBV','VR-Bank Isar-Vils','Dominik Holzner','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-6','db2bc953-d588-49ee-a069-9553d092b777'),(89,'Julian','Reiter','2016-11-25','m',0,NULL,NULL,NULL,'nicki83reiter@gmail.com','+49 170 9082040',NULL,NULL,NULL,NULL,'+49 170 9082040','Niedersattling','22a','84137','Vilsbiburg','Deutschland','DE50743923000000419907','GENODEF1VBV','VR-Bank Isar-Vils','Nicole Reiter','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-7','f2faf328-4ecf-484c-88cb-a9b8cb1937f0'),(90,'Sophia','Reiter','2024-01-30','w',0,NULL,NULL,NULL,'nicki83reiter@gmail.com','+49 170 9082040',NULL,NULL,NULL,NULL,'+49 170 9082040','Niedersattling','22a','84137','Vilsbiburg','Deutschland','DE50743923000000419907','GENODEF1VBV','VR-Bank Isar-Vils','Nicole Reiter','Lastschrift',NULL,'2025-12-04','2025-12-04',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.50,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'M-8','432f53e8-67ce-4fd1-b7df-534b3cfd9f58'),(93,'Christian','Dietrich','2018-02-28','m',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Oberndorf','24','84155','Bodenkirchen','Deutschland','DE60743923000000420891','GENODEF1VBV','VR-Bank Isar-Vils','Rosa Maria Dietrich','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-101','c784b600-4d15-4bea-93bb-22600d458f33'),(96,'Alexander','Ernst','2016-04-16','m',0,NULL,NULL,NULL,'nina.ernst1@web.de',NULL,NULL,NULL,NULL,NULL,NULL,'Steindlgasse','7','84137','Frauensattling','Deutschland','DE39743200730016763616','HYVEDEMM433','UniCredit Bank - HypoVereinsbank','Nina Ernst','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-104','3b2f7f0c-72cf-4471-9ed9-528574a8455b'),(97,'Sebastian','Westenthanner','2009-08-02','m',0,NULL,NULL,NULL,'dcwestenthanner@gmail.com','087419262324',NULL,NULL,NULL,NULL,'087419262324','Zenelliring','24','84155','Bodenkirchen','Deutschland','DE45743923000000305537','GENODEF1VBV','VR-Bank Isar-Vils','Claudia Westenthanner','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-105','41db03c1-1519-4ffd-983f-a41ba8bbd55e'),(99,'Julian','Heider','2018-10-17','m',0,NULL,NULL,NULL,'susanneheider@hotmail.com','087419675510',NULL,63,NULL,NULL,'087419675510','Brünnsteinstr.','3','84137','Vilsbiburg','Deutschland','DE24743900000008042039','GENODEF1LH1','VR-Bank Landshut','Susanne Heider','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.25,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-107','716800d6-cf04-43d2-959b-f468470b3c50'),(109,'Conner','Dobos','2013-07-31','m',0,NULL,NULL,NULL,'kathrin-riebesecker@web.de','01713430661',NULL,NULL,NULL,NULL,'01713430661','Hacken','1a','84178','Kröning','Deutschland','DE24743923000000425516','GENODEF1VBV','VR-Bank Isar-Vils','Ulrich Dobos','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,3.25,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-19','9242599d-9a54-49a7-b2ed-a4e2dfa22c07'),(111,'Lucas','Döping','2010-03-09','m',0,NULL,NULL,NULL,'claudia.doepping@gmail.com','01752223797',NULL,NULL,NULL,NULL,'01752223797','Am Rettenbach','1','84137','Vilsbiburg','Deutschland','DE89743500000020745656','BYLADEM1LAH','Sparkasse Landshut','Claudia Geier','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-20','c9ba54b4-320b-4cd7-b3eb-dd91bad40854'),(112,'Lea','Heider','2015-09-28','w',0,NULL,NULL,NULL,'susanneheider@hotmail.com','01712064678',NULL,NULL,NULL,NULL,'01712064678','Brünnsteinstr.','3','84137','Vilsbiburg','Deutschland','DE24743900000008042039','GENODEF1LH1','VR-Bank Landshut','Marco Heider','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.25,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-22','c768efb7-efb4-4131-9eae-edaa44067be5'),(113,'Elias','Haberl','1998-08-27','m',0,NULL,NULL,NULL,'haberlelias@gmail.com','01608855261',NULL,NULL,NULL,NULL,'01608855261','Ahornweg','1','84323','Massing','Deutschland',NULL,NULL,NULL,NULL,'Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-23','27e41bd2-7d0c-4724-ae9e-a5195d298d41'),(116,'Luca','Raiser','2010-08-25','m',0,NULL,NULL,NULL,'dani-raiser@gmx.de','015127510083',NULL,NULL,NULL,NULL,'015127510083','Kammersoed','1','84175','Gerzen','Deutschland','DE56743923000000039365','GENODEF1VBV','VR-Bank Isar-Vils','Daniela Raiser','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-26','bc18bb64-0c45-4fcc-bcb6-a106bdac4cf4'),(117,'Judith','Ramsauer','1981-04-22','w',0,NULL,NULL,NULL,'judith.ramsauer@gmx.de','01728267930',NULL,NULL,NULL,NULL,'01728267930','Predigtstuhlring','1','84137','Vilsbiburg','Deutschland','DE91711510200000623512','BYLADEM1MDF','Sparkasse Altötting-Mühldorf','Judith Ramsauer','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,NULL,'fa3a96e3-be2d-46b1-a5df-4f6fd4322a35'),(118,'Henry','Ramsauer','2015-08-28','m',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Predigtstuhlring','1','84137','Vilsbiburg','Deutschland','DE91711510200000623512','BYLADEM1MDF','Sparkasse Altötting-Mühldorf','Judith Ramsauer','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.25,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-28','08fc4ca2-8ac6-4e0a-8ec7-29901826b8b0'),(120,'Nico','Zuhmann','2013-08-02','m',0,NULL,NULL,NULL,'carmen.zuhmann@gmx.de','017665849155',NULL,NULL,NULL,NULL,'017665849155','Am Sonnenhang','2','84178','Kröning','Deutschland','DE87360100430608186436','PBNKDEFFXXX','Postbank Ndl der Deutsche Bank','Carmen Zuhmann','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.75,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-30','a21d27bb-092d-48b6-adaf-eb62110d91c1'),(125,'Noah','Samhuber','2000-07-22','m',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Sperberweg','11','84137','Vilsbiburg','Deutschland',NULL,NULL,NULL,NULL,'Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-37','1f9b518c-4486-4049-9cab-f67ca665e643'),(134,'Elias','Priller','2008-06-25','m',0,NULL,NULL,NULL,'margot@m.priller.de','01794150502',NULL,NULL,NULL,NULL,'01794150502','Holzhäuseln','1','84149','Velden','Deutschland','DE57743900000008972257','GENODEF1LH1','VR-Bank Landshut','Martin Priller','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-46','680f1aa3-33de-4f49-b3d2-519e38d28c8c'),(138,'Stephanie','Schreiner','1994-04-01','w',0,NULL,NULL,NULL,'headquarter@tda-intl.com','087415128335',NULL,NULL,NULL,NULL,'087415128335','Geigelsteinstr.','14','84137','Vilsbiburg','Deutschland',NULL,NULL,NULL,NULL,'Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,1,'Familie','1-4','2b53e963-5495-4b74-8d8e-40f9dafd8d3d'),(140,'Leonard','Kern','2000-02-01','m',0,NULL,NULL,NULL,'leonard.kern@t-online.de','+491772675832',NULL,NULL,NULL,NULL,'+491772675832','Tannenstr.','9a','84155','Bodenkirchen','Deutschland','DE07743500000021192847','BYLADEM1LAH','Sparkasse Landshut','Leonard Kern','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-51','1751e875-8558-4968-ae45-f3bc33a8571a'),(143,'Daniela','Aufinger','1987-07-26','w',0,NULL,NULL,NULL,'d.aufsinger@gmx.de','+491707340478',NULL,NULL,NULL,NULL,'+491707340478','Rachelstr.','16','84149','Velden','Deutschland','DE93700519950020610382','BYLADEM1ERD','Kreis- und Stadtsparkasse Erding-Dorfen','Daniela Aufinger','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-54','67bfb2cf-618a-4947-ada3-6db1834f8d76'),(145,'Bastian','Einwang','2010-12-30','m',0,NULL,NULL,NULL,'alexandrapreis@yahoo.de','+491637432932',NULL,NULL,NULL,NULL,'+491637432932','Michlbacherstr.','3','84155','Bodenkirchen','Deutschland','DE05743500000020474016','BYLADEM1LAH','Sparkasse Landshut','Alexandra Einwang','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-56','50215e48-7293-432e-b59f-ddebf601b841'),(146,'Lydia','Bichlmaier','1992-12-17','w',0,NULL,NULL,NULL,'lydiab92@gmx.de','+4915774148990',NULL,NULL,NULL,NULL,'+4915774148990','Hauslweid','41','84155','Bodenkirchen','Deutschland','DE10743500000004295005','BYLADEM1LAH','Sparkasse Landshut','Lydia Bichlmaier','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-57','04cfd362-0ab9-4af5-bb80-fea1838ddfba'),(148,'Stefanie','Dirnaichner','1994-08-21','w',0,NULL,NULL,NULL,'stefaniedirnaichner@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,'Margarethen','12a','84155','Bodenkirchen','Deutschland','DE85740618130006910521','GENODEF1PFK','VR-Bank Rottal-Inn','Stefanie Dirnaichner','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-59','dd815bfa-cc16-44d4-9f61-96d63de42efc'),(149,'Amalia','Lermer','2017-09-21','w',0,NULL,NULL,NULL,'julia.lermer@gmx.de','0176/23520918',NULL,NULL,NULL,NULL,'0176/23520918','Sportplatzstr','13','84137','Vilsbiburg','Deutschland','DE96120300001031179409','BYLADEM1001','Deutsche Kreditbank Berlin','Julia Lermer','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-60','8fc759bc-3f23-435d-97f3-8ca8b88506bf'),(152,'Sascha','Theil','1995-04-17','m',0,NULL,NULL,NULL,'vibst17@gmail.com','015231843392',NULL,NULL,NULL,NULL,'015231843392','Lehing','3','84155','Bodenkirchen','Deutschland','DE61743500000020362137','BYLADEM1LAH','Sparkasse Landshut','Sascha Theil','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-63','c25cfd36-c3b3-489f-a4a0-952d41ef4fab'),(153,'Christoph','Vierlbeck','1990-08-07','m',0,NULL,NULL,NULL,'christoph.vierlbeck@gmx.de','01704165376',NULL,NULL,NULL,NULL,'01704165376','Harpoldenerstr.','8a','84155','Bodenkirchen','Deutschland','DE53740618130004809980','GENODEF1PFK','VR-Bank Rottal-Inn','Christoph Vierlbeck','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.75,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-64','74d2959e-62bd-459a-9f72-90fc042e3d26'),(164,'Antonio','Biro','2016-03-03','m',0,NULL,NULL,NULL,NULL,'01748436681',NULL,NULL,NULL,NULL,'01748436681','Hauptstr.','22b','84155','Bodenkirchen','Deutschland','DE09743500000020856318','BYLADEM1LAH','Sparkasse Landshut','Robert Biro','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.50,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-77','e6b8ed4f-90e3-4e41-8a9f-0a09e5729c5b'),(166,'Maria-Magdalena','Erdmann','2011-09-05','w',0,NULL,NULL,NULL,'elly_b@gmx.net','01629161595',NULL,NULL,NULL,NULL,'01629161595','Am Feld','6','84546','Egglkofen','Deutschland','DE57700905000005504058','GENODEF1S04','Sparda-Bank München','Elisabeth Erdmann','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-79','9088f504-d468-460f-a13c-d80178a43ae6'),(168,'Jonas','Holzner','2006-01-17','m',0,NULL,NULL,NULL,NULL,'01757095116',NULL,NULL,NULL,NULL,'01757095116','Bujastr.','9','84137','Vilsbiburg','Deutschland','DE89743500000021166927','BYLADEM1LAH','Sparkasse Landshut','Jonas Holzner','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-80','ac5c4af1-b21b-4388-bee6-bcf2eebe7dee'),(169,'Dario','Santangelo','2016-08-11','m',0,NULL,NULL,NULL,'felicidadeElella@web.de','015730047441',NULL,NULL,NULL,NULL,'015730047441','Sportplatzstr.','3','84155','Bodenkirchen','Deutschland','DE25743923000000888770','GENODEF1VBV','VR-Bank Isar-Vils','Isabella Santangelo','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.75,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-81','b4bea1d5-6c54-45d1-afc3-62e961d3be6a'),(170,'Nina','Sprung','2019-05-20','w',0,NULL,NULL,NULL,NULL,'087451286',NULL,NULL,NULL,NULL,'087451286','Ahornstr.','1','84155','Bodenkirchen','Deutschland','DE30743923000000422983','GENODEF1VBV','VR-Bank Isar-Vils','Sybille Sprung','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-82','69d271ce-3d71-4979-8e7b-55bfa749073d'),(172,'Valentin','Geiringer','2011-09-11','m',0,NULL,NULL,NULL,'vale.katha@yahoo.com','08742/9653989',NULL,NULL,NULL,NULL,'08742/9653989','Moosing','1','84149','Velden vils','Deutschland','DE96711510200031386972','BYLADEM1MDF','Sparkasse Altötting-Mühldorf','Anna Geiringer','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-84','fa54ccfb-9a8d-4c59-bdee-0a962a695e25'),(173,'Peter','Geltinger','2013-03-31','m',0,NULL,NULL,NULL,'manfred.geltinger@gmx.de','08741 929579 ',NULL,NULL,NULL,NULL,'08741 929579 ','Schußöd ','33','84137','Vilsbiburg ','Deutschland','DE39743923000000301183','GENODEF1VBV','VR-Bank Isar-Vils','Manfred und Sabine Geltinger','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-85','8964b4d8-0275-4ca3-9974-8c2368054499'),(174,'Tim','Brandmeier','2008-05-01','m',0,NULL,NULL,NULL,'timbrandmeier1@gmail.com','0874591270',NULL,NULL,NULL,NULL,'0874591270','Gassau ','7','84155','Bodenkirchen','Deutschland','DE52740618130000331023','GENODEF1PFK','VR-Bank Rottal-Inn','Tim Brandmeier','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-86','d94984ff-cf92-498a-9da1-d29f862196bf'),(175,'Tina','Herbst','1982-09-13','w',0,NULL,NULL,NULL,'herbst.tina@gmx.de','01601869931',NULL,NULL,NULL,NULL,'01601869931','Am Wirtsacker ','14 B','84189','Wurmsham','Deutschland','DE69743900000008912580','GENODEF1LH1','VR-Bank Landshut','Tina HeyHerbst','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-87','d20e8b5d-998f-4c71-bd5c-651864f6e9ca'),(177,'Julian','Huber','2018-04-29','m',0,NULL,NULL,NULL,'sandra.thaller@gmx.de','015125317711',NULL,NULL,NULL,NULL,'015125317711','Müllerthann','2','84189','Wurmsham','Deutschland','DE05500105175409227027','INGDDEFFXXX','ING-DiBa','Sandra Huber','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-89','2d34b68b-75f4-4d1c-b529-58bcb8542358'),(179,'Lukas','Huber','2018-09-01','m',0,NULL,NULL,NULL,'huber.nadine1@web.de','08741 9498656',NULL,NULL,NULL,NULL,'08741 9498656','Dreisesselstrasse ','1','84155','Bodenkirchen ','Deutschland','DE75743923000000884863','GENODEF1VBV','VR-Bank Isar-Vils','Stefan Huber','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,2.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-90','894ec5af-9503-4a32-a8cf-5f55b67d3a95'),(185,'Johanna','Dauner','1987-03-10','w',0,NULL,NULL,NULL,'johanna.dauner@t-online.de','015756946411',NULL,NULL,NULL,NULL,'015756946411','Inzlham ','2','84573','Schönberg ','Deutschland','DE44120300001013599095','BYLADEM1001','Deutsche Kreditbank Berlin','Johanna Dauner','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,1.50,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-96','5c1779f2-6562-4c94-926b-daee741249fd'),(189,'Katja','Kölbl','1994-10-31','w',0,NULL,NULL,NULL,'koelbl.katja1212@gmail.com','01734501302',NULL,NULL,NULL,NULL,'01734501302','Straubingerstr.','2','84307','Eggenfelden','Deutschland','DE63740618130005060060','GENODEF1PFK','VR-Bank Rottal-Inn','Katja Koelbl','Lastschrift',NULL,'2025-12-07','2025-12-07',NULL,1,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,0,3,0.00,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,0,NULL,'1-9','e0bf5512-c921-4b95-b736-52d086aa815e');
/*!40000 ALTER TABLE `mitglieder` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglieder_dokumente`
--

DROP TABLE IF EXISTS `mitglieder_dokumente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglieder_dokumente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `dateiname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dateipfad` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dokumenttyp` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'z.B. vertrag, sepa_mandat, import_magicline',
  `hochgeladen_am` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `mitglied_id` (`mitglied_id`),
  CONSTRAINT `mitglieder_dokumente_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=415 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglieder_dokumente`
--

LOCK TABLES `mitglieder_dokumente` WRITE;
/*!40000 ALTER TABLE `mitglieder_dokumente` DISABLE KEYS */;
INSERT INTO `mitglieder_dokumente` VALUES (131,64,'magicline_0_SEPA-Mandat - 12.12.2024.pdf','/uploads/mitglieder/64/magicline_0_SEPA-Mandat - 12.12.2024.pdf','import_magicline','2025-12-04 11:29:15'),(132,64,'magicline_1_Vertrag - 12.12.2024.pdf','/uploads/mitglieder/64/magicline_1_Vertrag - 12.12.2024.pdf','import_magicline','2025-12-04 11:29:15'),(133,65,'magicline_0_SEPA-Mandat - 13.12.2024.pdf','/uploads/mitglieder/65/magicline_0_SEPA-Mandat - 13.12.2024.pdf','import_magicline','2025-12-04 11:29:15'),(134,65,'magicline_1_Vertrag - 13.12.2024.pdf','/uploads/mitglieder/65/magicline_1_Vertrag - 13.12.2024.pdf','import_magicline','2025-12-04 11:29:15'),(139,68,'magicline_0_SEPA-Mandat - 28.01.2025.pdf','/uploads/mitglieder/68/magicline_0_SEPA-Mandat - 28.01.2025.pdf','import_magicline','2025-12-04 11:29:15'),(140,68,'magicline_1_Vertrag - 28.01.2025.pdf','/uploads/mitglieder/68/magicline_1_Vertrag - 28.01.2025.pdf','import_magicline','2025-12-04 11:29:15'),(141,69,'magicline_0_SEPA-Mandat - 04.02.2025.pdf','/uploads/mitglieder/69/magicline_0_SEPA-Mandat - 04.02.2025.pdf','import_magicline','2025-12-04 11:29:15'),(142,69,'magicline_1_Vertrag - 04.02.2025.pdf','/uploads/mitglieder/69/magicline_1_Vertrag - 04.02.2025.pdf','import_magicline','2025-12-04 11:29:15'),(145,71,'magicline_0_SEPA-Mandat - 24.03.2025.pdf','/uploads/mitglieder/71/magicline_0_SEPA-Mandat - 24.03.2025.pdf','import_magicline','2025-12-04 11:29:15'),(146,71,'magicline_1_Vertrag - 24.03.2025.pdf','/uploads/mitglieder/71/magicline_1_Vertrag - 24.03.2025.pdf','import_magicline','2025-12-04 11:29:15'),(147,72,'magicline_0_SEPA-Mandat - 24.03.2025.pdf','/uploads/mitglieder/72/magicline_0_SEPA-Mandat - 24.03.2025.pdf','import_magicline','2025-12-04 11:29:15'),(148,72,'magicline_1_Vertrag - 24.03.2025.pdf','/uploads/mitglieder/72/magicline_1_Vertrag - 24.03.2025.pdf','import_magicline','2025-12-04 11:29:15'),(151,74,'magicline_0_SEPA-Mandat - 03.07.2025.pdf','/uploads/mitglieder/74/magicline_0_SEPA-Mandat - 03.07.2025.pdf','import_magicline','2025-12-04 11:29:15'),(152,74,'magicline_1_Vertrag - 03.07.2025.pdf','/uploads/mitglieder/74/magicline_1_Vertrag - 03.07.2025.pdf','import_magicline','2025-12-04 11:29:15'),(153,75,'magicline_0_SEPA-Mandat - 03.07.2025.pdf','/uploads/mitglieder/75/magicline_0_SEPA-Mandat - 03.07.2025.pdf','import_magicline','2025-12-04 11:29:15'),(154,75,'magicline_1_Vertrag - 03.07.2025.pdf','/uploads/mitglieder/75/magicline_1_Vertrag - 03.07.2025.pdf','import_magicline','2025-12-04 11:29:15'),(155,76,'magicline_0_SEPA-Mandat - 03.07.2025.pdf','/uploads/mitglieder/76/magicline_0_SEPA-Mandat - 03.07.2025.pdf','import_magicline','2025-12-04 11:29:15'),(156,76,'magicline_1_Vertrag - 03.07.2025.pdf','/uploads/mitglieder/76/magicline_1_Vertrag - 03.07.2025.pdf','import_magicline','2025-12-04 11:29:15'),(157,77,'magicline_0_SEPA-Mandat - 06.11.2025.pdf','/uploads/mitglieder/77/magicline_0_SEPA-Mandat - 06.11.2025.pdf','import_magicline','2025-12-04 11:29:16'),(158,77,'magicline_1_Vertrag - 06.11.2025.pdf','/uploads/mitglieder/77/magicline_1_Vertrag - 06.11.2025.pdf','import_magicline','2025-12-04 11:29:16'),(159,78,'magicline_0_SEPA-Mandat - 06.11.2025.pdf','/uploads/mitglieder/78/magicline_0_SEPA-Mandat - 06.11.2025.pdf','import_magicline','2025-12-04 11:29:16'),(160,78,'magicline_1_Vertrag - 06.11.2025.pdf','/uploads/mitglieder/78/magicline_1_Vertrag - 06.11.2025.pdf','import_magicline','2025-12-04 11:29:16'),(161,79,'magicline_0_SEPA-Mandat - 03.12.2025.pdf','/uploads/mitglieder/79/magicline_0_SEPA-Mandat - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(162,79,'magicline_1_Vertrag - 03.12.2025.pdf','/uploads/mitglieder/79/magicline_1_Vertrag - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(163,80,'magicline_0_SEPA-Mandat - 03.12.2025.pdf','/uploads/mitglieder/80/magicline_0_SEPA-Mandat - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(164,80,'magicline_1_Vertrag - 03.12.2025.pdf','/uploads/mitglieder/80/magicline_1_Vertrag - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(165,81,'magicline_0_SEPA-Mandat - 03.12.2025.pdf','/uploads/mitglieder/81/magicline_0_SEPA-Mandat - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(166,81,'magicline_1_Vertrag - 03.12.2025.pdf','/uploads/mitglieder/81/magicline_1_Vertrag - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(169,83,'magicline_0_SEPA-Mandat - 03.12.2025.pdf','/uploads/mitglieder/83/magicline_0_SEPA-Mandat - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(170,83,'magicline_1_Vertrag - 03.12.2025.pdf','/uploads/mitglieder/83/magicline_1_Vertrag - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(171,84,'magicline_0_SEPA-Mandat - 03.12.2025.pdf','/uploads/mitglieder/84/magicline_0_SEPA-Mandat - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(172,84,'magicline_1_Vertrag - 03.12.2025.pdf','/uploads/mitglieder/84/magicline_1_Vertrag - 03.12.2025.pdf','import_magicline','2025-12-04 11:29:16'),(179,87,'magicline_0_SEPA-Mandat - 16.05.2024.pdf','/uploads/mitglieder/87/magicline_0_SEPA-Mandat - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:17'),(180,87,'magicline_1_Vertrag - 16.05.2024.pdf','/uploads/mitglieder/87/magicline_1_Vertrag - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:17'),(181,88,'magicline_0_SEPA-Mandat - 16.05.2024.pdf','/uploads/mitglieder/88/magicline_0_SEPA-Mandat - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:18'),(182,88,'magicline_1_Vertrag - 16.05.2024.pdf','/uploads/mitglieder/88/magicline_1_Vertrag - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:18'),(183,88,'magicline_2_Vertrag - 16.05.2024.pdf','/uploads/mitglieder/88/magicline_2_Vertrag - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:18'),(184,89,'magicline_0_SEPA-Mandat - 16.05.2024.pdf','/uploads/mitglieder/89/magicline_0_SEPA-Mandat - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:18'),(185,89,'magicline_1_Vertrag - 16.05.2024.pdf','/uploads/mitglieder/89/magicline_1_Vertrag - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:18'),(186,90,'magicline_0_SEPA-Mandat - 16.05.2024.pdf','/uploads/mitglieder/90/magicline_0_SEPA-Mandat - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:18'),(187,90,'magicline_1_Vertrag - 16.05.2024.pdf','/uploads/mitglieder/90/magicline_1_Vertrag - 16.05.2024.pdf','import_magicline','2025-12-04 11:29:18'),(192,93,'magicline_0_SEPA-Mandat - 19.03.2024.pdf','/uploads/mitglieder/93/magicline_0_SEPA-Mandat - 19.03.2024.pdf','import_magicline','2025-12-07 22:14:44'),(193,93,'magicline_1_Vertrag - 19.03.2024.pdf','/uploads/mitglieder/93/magicline_1_Vertrag - 19.03.2024.pdf','import_magicline','2025-12-07 22:14:44'),(201,96,'magicline_0_SEPA-Mandat - 23.04.2024.pdf','/uploads/mitglieder/96/magicline_0_SEPA-Mandat - 23.04.2024.pdf','import_magicline','2025-12-07 22:14:44'),(202,96,'magicline_1_Vertrag - 23.04.2024.pdf','/uploads/mitglieder/96/magicline_1_Vertrag - 23.04.2024.pdf','import_magicline','2025-12-07 22:14:44'),(203,97,'magicline_0_SEPA-Mandat - 11.07.2024.pdf','/uploads/mitglieder/97/magicline_0_SEPA-Mandat - 11.07.2024.pdf','import_magicline','2025-12-07 22:14:44'),(204,97,'magicline_1_Vertrag - 11.07.2024.pdf','/uploads/mitglieder/97/magicline_1_Vertrag - 11.07.2024.pdf','import_magicline','2025-12-07 22:14:44'),(207,99,'magicline_0_SEPA-Mandat - 24.11.2024.pdf','/uploads/mitglieder/99/magicline_0_SEPA-Mandat - 24.11.2024.pdf','import_magicline','2025-12-07 22:14:44'),(208,99,'magicline_1_Vertrag - 24.11.2024.pdf','/uploads/mitglieder/99/magicline_1_Vertrag - 24.11.2024.pdf','import_magicline','2025-12-07 22:14:45'),(227,109,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/109/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:45'),(228,109,'magicline_1_SEPA-Mandat - 01.02.2022.pdf','/uploads/mitglieder/109/magicline_1_SEPA-Mandat - 01.02.2022.pdf','import_magicline','2025-12-07 22:14:45'),(229,109,'magicline_2_SEPA-Mandat - 01.02.2022.pdf','/uploads/mitglieder/109/magicline_2_SEPA-Mandat - 01.02.2022.pdf','import_magicline','2025-12-07 22:14:45'),(230,109,'magicline_3_SEPA-Mandat - 07.02.2022.pdf','/uploads/mitglieder/109/magicline_3_SEPA-Mandat - 07.02.2022.pdf','import_magicline','2025-12-07 22:14:45'),(233,111,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/111/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:46'),(234,111,'magicline_1_SEPA-Mandat - 18.07.2022.pdf','/uploads/mitglieder/111/magicline_1_SEPA-Mandat - 18.07.2022.pdf','import_magicline','2025-12-07 22:14:46'),(235,112,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/112/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:46'),(236,112,'magicline_1_SEPA-Mandat - 02.02.2022.pdf','/uploads/mitglieder/112/magicline_1_SEPA-Mandat - 02.02.2022.pdf','import_magicline','2025-12-07 22:14:47'),(237,112,'magicline_2_SEPA-Mandat - 07.02.2022.pdf','/uploads/mitglieder/112/magicline_2_SEPA-Mandat - 07.02.2022.pdf','import_magicline','2025-12-07 22:14:47'),(238,113,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/113/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:47'),(241,116,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/116/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:47'),(242,116,'magicline_1_SEPA-Mandat - 03.04.2022.pdf','/uploads/mitglieder/116/magicline_1_SEPA-Mandat - 03.04.2022.pdf','import_magicline','2025-12-07 22:14:47'),(243,117,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/117/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:50'),(244,117,'magicline_1_SEPA-Mandat - 03.04.2022.pdf','/uploads/mitglieder/117/magicline_1_SEPA-Mandat - 03.04.2022.pdf','import_magicline','2025-12-07 22:14:55'),(245,118,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/118/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:55'),(246,118,'magicline_1_SEPA-Mandat - 03.04.2022.pdf','/uploads/mitglieder/118/magicline_1_SEPA-Mandat - 03.04.2022.pdf','import_magicline','2025-12-07 22:14:55'),(251,120,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/120/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:14:59'),(252,120,'magicline_1_SEPA-Mandat - 07.02.2022.pdf','/uploads/mitglieder/120/magicline_1_SEPA-Mandat - 07.02.2022.pdf','import_magicline','2025-12-07 22:14:59'),(265,125,'magicline_0_Vertrag - 01.02.2022.pdf','/uploads/mitglieder/125/magicline_0_Vertrag - 01.02.2022.pdf','import_magicline','2025-12-07 22:15:00'),(285,134,'magicline_0_SEPA-Mandat - 01.03.2022.pdf','/uploads/mitglieder/134/magicline_0_SEPA-Mandat - 01.03.2022.pdf','import_magicline','2025-12-07 22:15:03'),(286,134,'magicline_1_Vertrag - 01.03.2022.pdf','/uploads/mitglieder/134/magicline_1_Vertrag - 01.03.2022.pdf','import_magicline','2025-12-07 22:15:03'),(295,138,'magicline_0_Vertrag - 20.01.2022.pdf','/uploads/mitglieder/138/magicline_0_Vertrag - 20.01.2022.pdf','import_magicline','2025-12-07 22:15:03'),(298,140,'magicline_0_SEPA-Mandat - 19.09.2022.pdf','/uploads/mitglieder/140/magicline_0_SEPA-Mandat - 19.09.2022.pdf','import_magicline','2025-12-07 22:15:05'),(299,140,'magicline_1_Vertrag - 19.09.2022.pdf','/uploads/mitglieder/140/magicline_1_Vertrag - 19.09.2022.pdf','import_magicline','2025-12-07 22:15:05'),(300,140,'magicline_2_SEPA-Mandat - 06.02.2025.pdf','/uploads/mitglieder/140/magicline_2_SEPA-Mandat - 06.02.2025.pdf','import_magicline','2025-12-07 22:15:05'),(306,143,'magicline_0_SEPA-Mandat - 22.09.2022.pdf','/uploads/mitglieder/143/magicline_0_SEPA-Mandat - 22.09.2022.pdf','import_magicline','2025-12-07 22:15:06'),(307,143,'magicline_1_Vertrag - 22.09.2022.pdf','/uploads/mitglieder/143/magicline_1_Vertrag - 22.09.2022.pdf','import_magicline','2025-12-07 22:15:06'),(308,143,'magicline_2_SEPA-Mandat - 22.09.2022.pdf','/uploads/mitglieder/143/magicline_2_SEPA-Mandat - 22.09.2022.pdf','import_magicline','2025-12-07 22:15:06'),(312,145,'magicline_0_SEPA-Mandat - 29.09.2022.pdf','/uploads/mitglieder/145/magicline_0_SEPA-Mandat - 29.09.2022.pdf','import_magicline','2025-12-07 22:15:07'),(313,145,'magicline_1_Vertrag - 29.09.2022.pdf','/uploads/mitglieder/145/magicline_1_Vertrag - 29.09.2022.pdf','import_magicline','2025-12-07 22:15:07'),(314,146,'magicline_0_Vertrag - 29.09.2022.pdf','/uploads/mitglieder/146/magicline_0_Vertrag - 29.09.2022.pdf','import_magicline','2025-12-07 22:15:07'),(315,146,'magicline_1_SEPA-Mandat - 30.09.2022.pdf','/uploads/mitglieder/146/magicline_1_SEPA-Mandat - 30.09.2022.pdf','import_magicline','2025-12-07 22:15:07'),(318,148,'magicline_0_SEPA-Mandat - 05.10.2022.pdf','/uploads/mitglieder/148/magicline_0_SEPA-Mandat - 05.10.2022.pdf','import_magicline','2025-12-07 22:15:08'),(319,148,'magicline_1_Vertrag - 05.10.2022.pdf','/uploads/mitglieder/148/magicline_1_Vertrag - 05.10.2022.pdf','import_magicline','2025-12-07 22:15:08'),(320,149,'magicline_0_Vertrag - 05.10.2022.pdf','/uploads/mitglieder/149/magicline_0_Vertrag - 05.10.2022.pdf','import_magicline','2025-12-07 22:15:08'),(321,149,'magicline_1_SEPA-Mandat - 05.10.2022.pdf','/uploads/mitglieder/149/magicline_1_SEPA-Mandat - 05.10.2022.pdf','import_magicline','2025-12-07 22:15:08'),(326,152,'magicline_0_Vertrag - 31.10.2022.pdf','/uploads/mitglieder/152/magicline_0_Vertrag - 31.10.2022.pdf','import_magicline','2025-12-07 22:15:09'),(327,152,'magicline_1_SEPA-Mandat - 31.10.2022.pdf','/uploads/mitglieder/152/magicline_1_SEPA-Mandat - 31.10.2022.pdf','import_magicline','2025-12-07 22:15:09'),(328,153,'magicline_0_Vertrag - 31.10.2022.pdf','/uploads/mitglieder/153/magicline_0_Vertrag - 31.10.2022.pdf','import_magicline','2025-12-07 22:15:09'),(329,153,'magicline_1_SEPA-Mandat - 04.11.2022.pdf','/uploads/mitglieder/153/magicline_1_SEPA-Mandat - 04.11.2022.pdf','import_magicline','2025-12-07 22:15:09'),(354,164,'magicline_0_SEPA-Mandat - 13.03.2023.pdf','/uploads/mitglieder/164/magicline_0_SEPA-Mandat - 13.03.2023.pdf','import_magicline','2025-12-07 22:15:12'),(355,164,'magicline_1_Vertrag - 13.03.2023.pdf','/uploads/mitglieder/164/magicline_1_Vertrag - 13.03.2023.pdf','import_magicline','2025-12-07 22:15:12'),(358,166,'magicline_0_SEPA-Mandat - 14.03.2023.pdf','/uploads/mitglieder/166/magicline_0_SEPA-Mandat - 14.03.2023.pdf','import_magicline','2025-12-07 22:15:12'),(359,166,'magicline_1_Vertrag - 14.03.2023.pdf','/uploads/mitglieder/166/magicline_1_Vertrag - 14.03.2023.pdf','import_magicline','2025-12-07 22:15:12'),(360,166,'magicline_2_Vertrag - 14.03.2023.pdf','/uploads/mitglieder/166/magicline_2_Vertrag - 14.03.2023.pdf','import_magicline','2025-12-07 22:15:12'),(361,166,'magicline_3_SEPA-Mandat - 14.03.2023.pdf','/uploads/mitglieder/166/magicline_3_SEPA-Mandat - 14.03.2023.pdf','import_magicline','2025-12-07 22:15:12'),(364,168,'magicline_0_SEPA-Mandat - 12.07.2023.pdf','/uploads/mitglieder/168/magicline_0_SEPA-Mandat - 12.07.2023.pdf','import_magicline','2025-12-07 22:15:13'),(365,168,'magicline_1_Vertrag - 12.07.2023.pdf','/uploads/mitglieder/168/magicline_1_Vertrag - 12.07.2023.pdf','import_magicline','2025-12-07 22:15:13'),(366,168,'magicline_2_Vertrag - 12.07.2023.pdf','/uploads/mitglieder/168/magicline_2_Vertrag - 12.07.2023.pdf','import_magicline','2025-12-07 22:15:13'),(367,169,'magicline_0_SEPA-Mandat - 31.07.2023.pdf','/uploads/mitglieder/169/magicline_0_SEPA-Mandat - 31.07.2023.pdf','import_magicline','2025-12-07 22:15:13'),(368,169,'magicline_1_Vertrag - 31.07.2023.pdf','/uploads/mitglieder/169/magicline_1_Vertrag - 31.07.2023.pdf','import_magicline','2025-12-07 22:15:13'),(369,170,'magicline_0_Vertrag - 25.10.2023.pdf','/uploads/mitglieder/170/magicline_0_Vertrag - 25.10.2023.pdf','import_magicline','2025-12-07 22:15:13'),(370,170,'magicline_1_SEPA-Mandat - 25.10.2023.pdf','/uploads/mitglieder/170/magicline_1_SEPA-Mandat - 25.10.2023.pdf','import_magicline','2025-12-07 22:15:14'),(373,172,'magicline_0_SEPA-Mandat - 07.11.2023.pdf','/uploads/mitglieder/172/magicline_0_SEPA-Mandat - 07.11.2023.pdf','import_magicline','2025-12-07 22:15:14'),(374,172,'magicline_1_Vertrag - 07.11.2023.pdf','/uploads/mitglieder/172/magicline_1_Vertrag - 07.11.2023.pdf','import_magicline','2025-12-07 22:15:14'),(375,173,'magicline_0_SEPA-Mandat - 12.11.2023.pdf','/uploads/mitglieder/173/magicline_0_SEPA-Mandat - 12.11.2023.pdf','import_magicline','2025-12-07 22:15:14'),(376,173,'magicline_1_Vertrag - 12.11.2023.pdf','/uploads/mitglieder/173/magicline_1_Vertrag - 12.11.2023.pdf','import_magicline','2025-12-07 22:15:14'),(377,174,'magicline_0_SEPA-Mandat - 12.11.2023.pdf','/uploads/mitglieder/174/magicline_0_SEPA-Mandat - 12.11.2023.pdf','import_magicline','2025-12-07 22:15:15'),(378,174,'magicline_1_Vertrag - 12.11.2023.pdf','/uploads/mitglieder/174/magicline_1_Vertrag - 12.11.2023.pdf','import_magicline','2025-12-07 22:15:15'),(379,174,'magicline_2_SEPA-Mandat - 04.02.2025.pdf','/uploads/mitglieder/174/magicline_2_SEPA-Mandat - 04.02.2025.pdf','import_magicline','2025-12-07 22:15:15'),(380,174,'magicline_3_Vertrag - 04.02.2025.pdf','/uploads/mitglieder/174/magicline_3_Vertrag - 04.02.2025.pdf','import_magicline','2025-12-07 22:15:15'),(381,175,'magicline_0_SEPA-Mandat - 13.11.2023.pdf','/uploads/mitglieder/175/magicline_0_SEPA-Mandat - 13.11.2023.pdf','import_magicline','2025-12-07 22:15:15'),(382,175,'magicline_1_Vertrag - 13.11.2023.pdf','/uploads/mitglieder/175/magicline_1_Vertrag - 13.11.2023.pdf','import_magicline','2025-12-07 22:15:15'),(385,177,'magicline_0_SEPA-Mandat - 22.11.2023.pdf','/uploads/mitglieder/177/magicline_0_SEPA-Mandat - 22.11.2023.pdf','import_magicline','2025-12-07 22:15:15'),(386,177,'magicline_1_Vertrag - 22.11.2023.pdf','/uploads/mitglieder/177/magicline_1_Vertrag - 22.11.2023.pdf','import_magicline','2025-12-07 22:15:15'),(389,179,'magicline_0_SEPA-Mandat - 28.11.2023.pdf','/uploads/mitglieder/179/magicline_0_SEPA-Mandat - 28.11.2023.pdf','import_magicline','2025-12-07 22:15:16'),(390,179,'magicline_1_Vertrag - 28.11.2023.pdf','/uploads/mitglieder/179/magicline_1_Vertrag - 28.11.2023.pdf','import_magicline','2025-12-07 22:15:16'),(403,185,'magicline_0_SEPA-Mandat - 07.02.2024.pdf','/uploads/mitglieder/185/magicline_0_SEPA-Mandat - 07.02.2024.pdf','import_magicline','2025-12-07 22:15:17'),(404,185,'magicline_1_Vertrag - 07.02.2024.pdf','/uploads/mitglieder/185/magicline_1_Vertrag - 07.02.2024.pdf','import_magicline','2025-12-07 22:15:17'),(411,189,'magicline_0_Vertrag - 21.01.2022.pdf','/uploads/mitglieder/189/magicline_0_Vertrag - 21.01.2022.pdf','import_magicline','2025-12-07 22:15:19'),(412,189,'magicline_1_SEPA-Mandat - 02.02.2022.pdf','/uploads/mitglieder/189/magicline_1_SEPA-Mandat - 02.02.2022.pdf','import_magicline','2025-12-07 22:15:19'),(413,189,'magicline_2_SEPA-Mandat - 07.02.2022.pdf','/uploads/mitglieder/189/magicline_2_SEPA-Mandat - 07.02.2022.pdf','import_magicline','2025-12-07 22:15:19'),(414,189,'magicline_3_SEPA-Mandat - 07.02.2022.pdf','/uploads/mitglieder/189/magicline_3_SEPA-Mandat - 07.02.2022.pdf','import_magicline','2025-12-07 22:15:19');
/*!40000 ALTER TABLE `mitglieder_dokumente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglieder_fortschritt`
--

DROP TABLE IF EXISTS `mitglieder_fortschritt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglieder_fortschritt` (
  `fortschritt_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `kategorie_id` int NOT NULL,
  `skill_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `fortschritt_prozent` int DEFAULT '0',
  `status` enum('nicht_gestartet','in_arbeit','gemeistert','auf_eis') COLLATE utf8mb4_unicode_ci DEFAULT 'nicht_gestartet',
  `prioritaet` enum('niedrig','mittel','hoch','kritisch') COLLATE utf8mb4_unicode_ci DEFAULT 'mittel',
  `schwierigkeit` enum('anfaenger','fortgeschritten','experte','meister') COLLATE utf8mb4_unicode_ci DEFAULT 'anfaenger',
  `gestartet_am` date DEFAULT NULL,
  `gemeistert_am` date DEFAULT NULL,
  `ziel_datum` date DEFAULT NULL,
  `trainer_bewertung` int DEFAULT NULL,
  `trainer_kommentar` text COLLATE utf8mb4_unicode_ci,
  `bewertet_von` int DEFAULT NULL,
  `bewertet_am` timestamp NULL DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`fortschritt_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_kategorie` (`kategorie_id`),
  KEY `idx_status` (`status`),
  KEY `idx_prioritaet` (`prioritaet`),
  CONSTRAINT `mitglieder_fortschritt_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `mitglieder_fortschritt_ibfk_2` FOREIGN KEY (`kategorie_id`) REFERENCES `fortschritt_kategorien` (`kategorie_id`) ON DELETE CASCADE,
  CONSTRAINT `mitglieder_fortschritt_chk_1` CHECK (((`fortschritt_prozent` >= 0) and (`fortschritt_prozent` <= 100))),
  CONSTRAINT `mitglieder_fortschritt_chk_2` CHECK (((`trainer_bewertung` >= 1) and (`trainer_bewertung` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglieder_fortschritt`
--

LOCK TABLES `mitglieder_fortschritt` WRITE;
/*!40000 ALTER TABLE `mitglieder_fortschritt` DISABLE KEYS */;
/*!40000 ALTER TABLE `mitglieder_fortschritt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglieder_meilensteine`
--

DROP TABLE IF EXISTS `mitglieder_meilensteine`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglieder_meilensteine` (
  `meilenstein_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `titel` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `typ` enum('pruefung','turnier','achievement','persoenlich','sonstiges') COLLATE utf8mb4_unicode_ci DEFAULT 'achievement',
  `erreicht` tinyint(1) DEFAULT '0',
  `erreicht_am` date DEFAULT NULL,
  `ziel_datum` date DEFAULT NULL,
  `belohnung` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auszeichnung_bild_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oeffentlich` tinyint(1) DEFAULT '0',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`meilenstein_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_typ` (`typ`),
  KEY `idx_erreicht` (`erreicht`),
  CONSTRAINT `mitglieder_meilensteine_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglieder_meilensteine`
--

LOCK TABLES `mitglieder_meilensteine` WRITE;
/*!40000 ALTER TABLE `mitglieder_meilensteine` DISABLE KEYS */;
/*!40000 ALTER TABLE `mitglieder_meilensteine` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitglieder_ziele`
--

DROP TABLE IF EXISTS `mitglieder_ziele`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitglieder_ziele` (
  `ziel_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `titel` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `start_datum` date NOT NULL,
  `ziel_datum` date NOT NULL,
  `status` enum('aktiv','erreicht','verfehlt','abgebrochen') COLLATE utf8mb4_unicode_ci DEFAULT 'aktiv',
  `fortschritt_prozent` int DEFAULT '0',
  `messbar` tinyint(1) DEFAULT '0',
  `einheit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ziel_wert` decimal(10,2) DEFAULT NULL,
  `aktueller_wert` decimal(10,2) DEFAULT '0.00',
  `prioritaet` enum('niedrig','mittel','hoch') COLLATE utf8mb4_unicode_ci DEFAULT 'mittel',
  `erreicht_am` date DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ziel_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_status` (`status`),
  KEY `idx_ziel_datum` (`ziel_datum`),
  CONSTRAINT `mitglieder_ziele_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `mitglieder_ziele_chk_1` CHECK (((`fortschritt_prozent` >= 0) and (`fortschritt_prozent` <= 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglieder_ziele`
--

LOCK TABLES `mitglieder_ziele` WRITE;
/*!40000 ALTER TABLE `mitglieder_ziele` DISABLE KEYS */;
/*!40000 ALTER TABLE `mitglieder_ziele` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nachrichten`
--

DROP TABLE IF EXISTS `nachrichten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nachrichten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int DEFAULT NULL,
  `betreff` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nachricht` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'entwurf',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nachrichten`
--

LOCK TABLES `nachrichten` WRITE;
/*!40000 ALTER TABLE `nachrichten` DISABLE KEYS */;
/*!40000 ALTER TABLE `nachrichten` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `newsletter_subscriptions`
--

DROP TABLE IF EXISTS `newsletter_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `newsletter_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','unsubscribed','bounced') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `subscription_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `unsubscribe_date` timestamp NULL DEFAULT NULL,
  `unsubscribe_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferences` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`),
  CONSTRAINT `newsletter_subscriptions_chk_1` CHECK (json_valid(`preferences`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `newsletter_subscriptions`
--

LOCK TABLES `newsletter_subscriptions` WRITE;
/*!40000 ALTER TABLE `newsletter_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `newsletter_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_queue`
--

DROP TABLE IF EXISTS `notification_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('email','push','sms') COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `template_id` int DEFAULT NULL,
  `scheduled_at` timestamp NOT NULL,
  `status` enum('pending','processing','sent','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `attempts` int DEFAULT '0',
  `max_attempts` int DEFAULT '3',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_scheduled_at` (`scheduled_at`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`),
  CONSTRAINT `notification_queue_chk_1` CHECK (json_valid(`metadata`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_queue`
--

LOCK TABLES `notification_queue` WRITE;
/*!40000 ALTER TABLE `notification_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_settings`
--

DROP TABLE IF EXISTS `notification_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_settings` (
  `id` int NOT NULL DEFAULT '1',
  `email_enabled` tinyint(1) DEFAULT '0',
  `push_enabled` tinyint(1) DEFAULT '0',
  `email_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `push_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `default_from_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_from_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Dojo Software',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `notification_settings_chk_1` CHECK (json_valid(`email_config`)),
  CONSTRAINT `notification_settings_chk_2` CHECK (json_valid(`push_config`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_settings`
--

LOCK TABLES `notification_settings` WRITE;
/*!40000 ALTER TABLE `notification_settings` DISABLE KEYS */;
INSERT INTO `notification_settings` VALUES (1,1,0,'{\"protocol\":\"smtp\",\"smtp_host\":\"alfa3085.alfahosting-server.de\",\"smtp_port\":465,\"imap_host\":\"\",\"imap_port\":993,\"pop3_host\":\"alfa3085.alfahosting-server.de\",\"pop3_port\":995,\"smtp_secure\":false,\"smtp_user\":\"admin\",\"smtp_password\":\"admin123\"}','{}','headquarter@tda-intl.com','Kampfsportschule Schreiner','2025-10-15 10:42:12','2025-12-21 20:52:30');
/*!40000 ALTER TABLE `notification_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('email','push','sms','admin_alert') COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','sent','failed','delivered','unread','read') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `template_id` int DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `requires_confirmation` tinyint(1) DEFAULT '0',
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `confirmed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_recipient` (`recipient`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `notifications_chk_1` CHECK (json_valid(`metadata`))
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (67,'push','admin@tda-intl.org','test','test','sent',NULL,NULL,NULL,0,NULL,NULL,'2025-12-15 05:56:55',NULL,NULL);
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `offene_posten`
--

DROP TABLE IF EXISTS `offene_posten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offene_posten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `zehnerkarte_id` int DEFAULT NULL,
  `vertrag_id` int DEFAULT NULL,
  `betrag_cents` int NOT NULL,
  `beschreibung` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `faellig_am` date NOT NULL,
  `status` enum('offen','gebucht','storniert') COLLATE utf8mb4_unicode_ci DEFAULT 'offen',
  `zahlungsart` enum('lastschrift','rechnung','bar') COLLATE utf8mb4_unicode_ci DEFAULT 'lastschrift',
  `gebucht_am` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `zehnerkarte_id` (`zehnerkarte_id`),
  KEY `idx_mitglied_status` (`mitglied_id`,`status`),
  KEY `idx_faellig` (`faellig_am`),
  KEY `idx_status` (`status`),
  CONSTRAINT `offene_posten_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `offene_posten_ibfk_2` FOREIGN KEY (`zehnerkarte_id`) REFERENCES `zehnerkarten` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `offene_posten`
--

LOCK TABLES `offene_posten` WRITE;
/*!40000 ALTER TABLE `offene_posten` DISABLE KEYS */;
/*!40000 ALTER TABLE `offene_posten` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_provider_logs`
--

DROP TABLE IF EXISTS `payment_provider_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_provider_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int DEFAULT NULL,
  `mitglied_id` int DEFAULT NULL,
  `provider` enum('manual_sepa','stripe_datev') COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'create_payment, export_datev, etc.',
  `status` enum('success','error','warning') COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Request/Response Daten',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `dojo_id` (`dojo_id`),
  KEY `mitglied_id` (`mitglied_id`),
  KEY `idx_provider_action` (`provider`,`action`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`),
  CONSTRAINT `payment_provider_logs_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_provider_logs_ibfk_2` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE SET NULL,
  CONSTRAINT `payment_provider_logs_chk_1` CHECK (json_valid(`data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Logs f├╝r Payment Provider Debugging';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_provider_logs`
--

LOCK TABLES `payment_provider_logs` WRITE;
/*!40000 ALTER TABLE `payment_provider_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_provider_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal`
--

DROP TABLE IF EXISTS `personal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal` (
  `personal_id` int NOT NULL AUTO_INCREMENT,
  `personalnummer` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vorname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nachname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `titel` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geburtsdatum` date DEFAULT NULL,
  `geschlecht` enum('m','w','d') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `handy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hausnummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `land` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Deutschland',
  `position` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abteilung` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `einstellungsdatum` date NOT NULL,
  `kuendigungsdatum` date DEFAULT NULL,
  `beschaeftigungsart` enum('Vollzeit','Teilzeit','Minijob','Praktikant','Freelancer') COLLATE utf8mb4_unicode_ci NOT NULL,
  `arbeitszeit_stunden` decimal(4,2) DEFAULT NULL,
  `grundgehalt` decimal(10,2) DEFAULT NULL,
  `stundenlohn` decimal(6,2) DEFAULT NULL,
  `waehrung` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT 'EUR',
  `ausbildung` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zertifikate` text COLLATE utf8mb4_unicode_ci,
  `kampfkunst_graduierung` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staatsangehoerigkeit` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arbeitserlaubnis` tinyint(1) DEFAULT '1',
  `sozialversicherungsnummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `steuerklasse` enum('I','II','III','IV','V','VI') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `iban` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bic` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('aktiv','inaktiv','gekuendigt','beurlaubt') COLLATE utf8mb4_unicode_ci DEFAULT 'aktiv',
  `notizen` text COLLATE utf8mb4_unicode_ci,
  `foto_pfad` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `erstellt_von` int DEFAULT NULL,
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`personal_id`),
  UNIQUE KEY `personalnummer` (`personalnummer`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_personalnummer` (`personalnummer`),
  KEY `idx_name` (`nachname`,`vorname`),
  KEY `idx_email` (`email`),
  KEY `idx_position` (`position`),
  KEY `idx_status` (`status`),
  KEY `idx_einstellungsdatum` (`einstellungsdatum`),
  KEY `idx_personal_dojo_id` (`dojo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal`
--

LOCK TABLES `personal` WRITE;
/*!40000 ALTER TABLE `personal` DISABLE KEYS */;
INSERT INTO `personal` VALUES (1,'MA001','Max','Mustermann',NULL,NULL,NULL,'max.mustermann@dojo.local','+49 123 456789',NULL,NULL,NULL,NULL,NULL,'Deutschland','Dojo-Leiter',NULL,'2020-01-15',NULL,'Vollzeit',NULL,3500.00,25.00,'EUR',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,'aktiv',NULL,NULL,'2025-09-08 19:18:17','2025-09-09 11:50:30',NULL,1),(2,'MA002','Anna','Schmidt',NULL,NULL,NULL,'anna.schmidt@dojo.local','+49 123 456790',NULL,NULL,NULL,NULL,NULL,'Deutschland','Trainer',NULL,'2021-03-01',NULL,'Teilzeit',NULL,2200.00,18.50,'EUR',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,'aktiv',NULL,NULL,'2025-09-08 19:18:17','2025-09-09 11:50:30',NULL,1),(3,'MA003','Peter','Wagner',NULL,NULL,NULL,'peter.wagner@dojo.local','+49 123 456791',NULL,NULL,NULL,NULL,NULL,'Deutschland','Rezeption',NULL,'2022-06-01',NULL,'Vollzeit',NULL,2800.00,15.00,'EUR',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,'aktiv',NULL,NULL,'2025-09-08 19:18:17','2025-09-09 11:50:30',NULL,1);
/*!40000 ALTER TABLE `personal` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_arbeitszeit`
--

DROP TABLE IF EXISTS `personal_arbeitszeit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_arbeitszeit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `personal_id` int NOT NULL,
  `datum` date NOT NULL,
  `start_zeit` time NOT NULL,
  `end_zeit` time DEFAULT NULL,
  `pause_minuten` int DEFAULT '0',
  `stunden_gesamt` decimal(4,2) DEFAULT NULL,
  `notizen` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_personal_datum` (`personal_id`,`datum`),
  KEY `idx_datum` (`datum`),
  CONSTRAINT `personal_arbeitszeit_ibfk_1` FOREIGN KEY (`personal_id`) REFERENCES `personal` (`personal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_arbeitszeit`
--

LOCK TABLES `personal_arbeitszeit` WRITE;
/*!40000 ALTER TABLE `personal_arbeitszeit` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_arbeitszeit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_berechtigungen`
--

DROP TABLE IF EXISTS `personal_berechtigungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_berechtigungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `personal_id` int NOT NULL,
  `berechtigung` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `erteilt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `erteilt_von` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_permission` (`personal_id`,`berechtigung`),
  KEY `idx_berechtigung` (`berechtigung`),
  CONSTRAINT `personal_berechtigungen_ibfk_1` FOREIGN KEY (`personal_id`) REFERENCES `personal` (`personal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_berechtigungen`
--

LOCK TABLES `personal_berechtigungen` WRITE;
/*!40000 ALTER TABLE `personal_berechtigungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_berechtigungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_checkin`
--

DROP TABLE IF EXISTS `personal_checkin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_checkin` (
  `checkin_id` int NOT NULL AUTO_INCREMENT,
  `personal_id` int NOT NULL,
  `checkin_time` datetime NOT NULL,
  `checkout_time` datetime DEFAULT NULL,
  `arbeitszeit_minuten` int DEFAULT NULL COMMENT 'Berechnete Arbeitszeit in Minuten',
  `kosten` decimal(10,2) DEFAULT NULL COMMENT 'Berechnete Kosten basierend auf Stundenlohn',
  `bemerkung` text COLLATE utf8mb4_unicode_ci,
  `status` enum('eingecheckt','ausgecheckt') COLLATE utf8mb4_unicode_ci DEFAULT 'eingecheckt',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`checkin_id`),
  KEY `idx_personal_datum` (`personal_id`,`checkin_time`),
  KEY `idx_status` (`status`),
  KEY `idx_checkin_time` (`checkin_time`),
  CONSTRAINT `personal_checkin_ibfk_1` FOREIGN KEY (`personal_id`) REFERENCES `personal` (`personal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Personal Check-in/Check-out System';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_checkin`
--

LOCK TABLES `personal_checkin` WRITE;
/*!40000 ALTER TABLE `personal_checkin` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_checkin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_urlaub`
--

DROP TABLE IF EXISTS `personal_urlaub`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_urlaub` (
  `id` int NOT NULL AUTO_INCREMENT,
  `personal_id` int NOT NULL,
  `typ` enum('Urlaub','Krankheit','Fortbildung','Sonderurlaub','Unbezahlt') COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_datum` date NOT NULL,
  `end_datum` date NOT NULL,
  `tage_gesamt` int DEFAULT NULL,
  `grund` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('beantragt','genehmigt','abgelehnt','storniert') COLLATE utf8mb4_unicode_ci DEFAULT 'beantragt',
  `genehmigt_von` int DEFAULT NULL,
  `genehmigt_am` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_personal_datum` (`personal_id`,`start_datum`),
  KEY `idx_status` (`status`),
  CONSTRAINT `personal_urlaub_ibfk_1` FOREIGN KEY (`personal_id`) REFERENCES `personal` (`personal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_urlaub`
--

LOCK TABLES `personal_urlaub` WRITE;
/*!40000 ALTER TABLE `personal_urlaub` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_urlaub` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pruefung_anforderungen`
--

DROP TABLE IF EXISTS `pruefung_anforderungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pruefung_anforderungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `graduierung_id` int NOT NULL COMMENT 'Graduierung, für die die Anforderung gilt',
  `stil_id` int NOT NULL COMMENT 'Stil',
  `anforderungstyp` enum('technik','kata','kumite','theorie','fitness','sonstiges') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Art der Anforderung',
  `bezeichnung` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Name/Bezeichnung der Anforderung',
  `beschreibung` text COLLATE utf8mb4_unicode_ci COMMENT 'Detaillierte Beschreibung',
  `min_punktzahl` decimal(5,2) DEFAULT NULL COMMENT 'Mindest-Punktzahl zum Bestehen',
  `max_punktzahl` decimal(5,2) DEFAULT NULL COMMENT 'Maximal erreichbare Punktzahl',
  `gewichtung` decimal(5,2) DEFAULT '1.00' COMMENT 'Gewichtung bei Gesamtbewertung',
  `reihenfolge` int DEFAULT '0' COMMENT 'Reihenfolge bei der Prüfung',
  `pflichtanforderung` tinyint(1) DEFAULT '1' COMMENT 'Muss erfüllt werden?',
  `aktiv` tinyint(1) DEFAULT '1' COMMENT 'Anforderung aktiv?',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_graduierung` (`graduierung_id`),
  KEY `idx_stil` (`stil_id`),
  KEY `idx_typ` (`anforderungstyp`),
  KEY `idx_aktiv` (`aktiv`),
  CONSTRAINT `pruefung_anforderungen_ibfk_1` FOREIGN KEY (`graduierung_id`) REFERENCES `graduierungen` (`graduierung_id`) ON DELETE CASCADE,
  CONSTRAINT `pruefung_anforderungen_ibfk_2` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Anforderungen für Gürtelprüfungen';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefung_anforderungen`
--

LOCK TABLES `pruefung_anforderungen` WRITE;
/*!40000 ALTER TABLE `pruefung_anforderungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `pruefung_anforderungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pruefung_bewertungen`
--

DROP TABLE IF EXISTS `pruefung_bewertungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pruefung_bewertungen` (
  `bewertung_id` int NOT NULL AUTO_INCREMENT,
  `pruefung_id` int NOT NULL,
  `inhalt_id` int NOT NULL,
  `bestanden` tinyint(1) DEFAULT NULL COMMENT 'Ob diese Technik bestanden wurde',
  `punktzahl` decimal(5,2) DEFAULT NULL COMMENT 'Erreichte Punktzahl fÃ¼r diese Technik',
  `max_punktzahl` decimal(5,2) DEFAULT '10.00' COMMENT 'Maximale Punktzahl fÃ¼r diese Technik',
  `kommentar` text COLLATE utf8mb4_unicode_ci COMMENT 'Kommentar des PrÃ¼fers zu dieser Technik',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`bewertung_id`),
  UNIQUE KEY `unique_pruefung_inhalt` (`pruefung_id`,`inhalt_id`),
  KEY `idx_pruefung` (`pruefung_id`),
  KEY `idx_inhalt` (`inhalt_id`),
  CONSTRAINT `pruefung_bewertungen_ibfk_1` FOREIGN KEY (`pruefung_id`) REFERENCES `pruefungen` (`pruefung_id`) ON DELETE CASCADE,
  CONSTRAINT `pruefung_bewertungen_ibfk_2` FOREIGN KEY (`inhalt_id`) REFERENCES `pruefungsinhalte` (`inhalt_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefung_bewertungen`
--

LOCK TABLES `pruefung_bewertungen` WRITE;
/*!40000 ALTER TABLE `pruefung_bewertungen` DISABLE KEYS */;
INSERT INTO `pruefung_bewertungen` VALUES (8,3,61,1,NULL,10.00,NULL,'2025-12-15 07:08:15','2025-12-15 07:08:15'),(9,3,62,1,NULL,10.00,NULL,'2025-12-15 07:08:15','2025-12-15 07:08:15'),(10,3,63,1,NULL,10.00,NULL,'2025-12-15 07:08:15','2025-12-15 07:08:15'),(11,3,64,1,NULL,10.00,NULL,'2025-12-15 07:08:15','2025-12-15 07:08:15'),(12,3,65,1,NULL,10.00,NULL,'2025-12-15 07:08:15','2025-12-15 07:08:15'),(13,3,66,1,NULL,10.00,NULL,'2025-12-15 07:08:15','2025-12-15 07:08:15'),(14,3,67,1,NULL,10.00,NULL,'2025-12-15 07:08:15','2025-12-15 07:08:15');
/*!40000 ALTER TABLE `pruefung_bewertungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pruefung_teilnehmer`
--

DROP TABLE IF EXISTS `pruefung_teilnehmer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pruefung_teilnehmer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pruefung_id` int NOT NULL COMMENT 'Referenz zur Prüfung',
  `mitglied_id` int NOT NULL COMMENT 'Teilnehmendes Mitglied',
  `angemeldet_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Anmeldezeitpunkt',
  `status` enum('angemeldet','teilgenommen','abwesend','abgesagt') COLLATE utf8mb4_unicode_ci DEFAULT 'angemeldet',
  `bestanden` tinyint(1) DEFAULT NULL COMMENT 'Individuelles Ergebnis',
  `punktzahl` decimal(5,2) DEFAULT NULL COMMENT 'Individuelle Punktzahl',
  `kommentar` text COLLATE utf8mb4_unicode_ci COMMENT 'Individueller Kommentar',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_pruefung_mitglied` (`pruefung_id`,`mitglied_id`),
  KEY `idx_pruefung` (`pruefung_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  CONSTRAINT `pruefung_teilnehmer_ibfk_1` FOREIGN KEY (`pruefung_id`) REFERENCES `pruefungen` (`pruefung_id`) ON DELETE CASCADE,
  CONSTRAINT `pruefung_teilnehmer_ibfk_2` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Teilnehmer bei Gruppenprüfungen';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefung_teilnehmer`
--

LOCK TABLES `pruefung_teilnehmer` WRITE;
/*!40000 ALTER TABLE `pruefung_teilnehmer` DISABLE KEYS */;
/*!40000 ALTER TABLE `pruefung_teilnehmer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pruefungen`
--

DROP TABLE IF EXISTS `pruefungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pruefungen` (
  `pruefung_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL COMMENT 'Mitglied, das geprüft wurde',
  `stil_id` int NOT NULL COMMENT 'Stil, in dem die Prüfung stattfand',
  `dojo_id` int NOT NULL COMMENT 'Dojo, in dem die Prüfung stattfand',
  `graduierung_vorher_id` int DEFAULT NULL COMMENT 'Graduierung vor der Prüfung (NULL bei erster Prüfung)',
  `graduierung_nachher_id` int NOT NULL COMMENT 'Angestrebte/erreichte Graduierung',
  `pruefungsdatum` date NOT NULL COMMENT 'Datum der Prüfung',
  `pruefungsort` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ort der Prüfung (falls abweichend vom Dojo)',
  `bestanden` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Prüfung bestanden?',
  `punktzahl` decimal(5,2) DEFAULT NULL COMMENT 'Erreichte Punktzahl (optional)',
  `max_punktzahl` decimal(5,2) DEFAULT NULL COMMENT 'Maximal mögliche Punktzahl (optional)',
  `pruefer_id` int DEFAULT NULL COMMENT 'Hauptprüfer (Referenz auf mitglieder oder trainer)',
  `prueferkommentar` text COLLATE utf8mb4_unicode_ci COMMENT 'Kommentar des Prüfers',
  `pruefungsgebuehr` decimal(10,2) DEFAULT NULL COMMENT 'Prüfungsgebühr',
  `gebuehr_bezahlt` tinyint(1) DEFAULT '0' COMMENT 'Gebühr bezahlt?',
  `bezahldatum` date DEFAULT NULL COMMENT 'Datum der Bezahlung',
  `urkunde_ausgestellt` tinyint(1) DEFAULT '0' COMMENT 'Urkunde ausgestellt?',
  `urkunde_nr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Urkunden-Nummer',
  `urkunde_pfad` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pfad zur Urkunden-PDF',
  `dokumente_pfad` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pfad zu weiteren Dokumenten',
  `pruefungsinhalte` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Detaillierte Prüfungsinhalte als JSON',
  `einzelbewertungen` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Einzelbewertungen als JSON (Kata, Kumite, etc.)',
  `status` enum('geplant','durchgefuehrt','bestanden','nicht_bestanden','abgesagt') COLLATE utf8mb4_unicode_ci DEFAULT 'geplant' COMMENT 'Prüfungsstatus',
  `anmerkungen` text COLLATE utf8mb4_unicode_ci COMMENT 'Allgemeine Anmerkungen',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Erstellungszeitpunkt',
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Letzte Änderung',
  `erstellt_von` int DEFAULT NULL COMMENT 'Benutzer, der den Eintrag erstellt hat',
  `pruefungszeit` time DEFAULT '10:00:00' COMMENT 'Uhrzeit der Pr├╝fung',
  `anmeldefrist` date DEFAULT NULL COMMENT 'Anmeldefrist f├╝r die Pr├╝fung',
  `gurtlaenge` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Empfohlene Gurtl├ñnge (z.B. 260 cm)',
  `bemerkungen` text COLLATE utf8mb4_unicode_ci COMMENT 'Allgemeine Bemerkungen zur Pr├╝fung',
  `teilnahmebedingungen` text COLLATE utf8mb4_unicode_ci COMMENT 'Teilnahmebedingungen f├╝r die Pr├╝fung',
  `teilnahme_bestaetigt` tinyint(1) DEFAULT '0' COMMENT 'Hat das Mitglied die Teilnahme best├ñtigt?',
  `teilnahme_bestaetigt_am` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Teilnahmebest├ñtigung',
  PRIMARY KEY (`pruefung_id`),
  KEY `graduierung_vorher_id` (`graduierung_vorher_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_stil` (`stil_id`),
  KEY `idx_dojo` (`dojo_id`),
  KEY `idx_datum` (`pruefungsdatum`),
  KEY `idx_status` (`status`),
  KEY `idx_bestanden` (`bestanden`),
  KEY `idx_graduierung_nachher` (`graduierung_nachher_id`),
  KEY `idx_mitglied_stil` (`mitglied_id`,`stil_id`),
  KEY `idx_mitglied_datum` (`mitglied_id`,`pruefungsdatum`),
  KEY `idx_stil_datum` (`stil_id`,`pruefungsdatum`),
  KEY `idx_pruefungen_anmeldefrist` (`anmeldefrist`),
  KEY `idx_pruefungen_teilnahme` (`teilnahme_bestaetigt`,`status`),
  CONSTRAINT `pruefungen_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `pruefungen_ibfk_2` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`),
  CONSTRAINT `pruefungen_ibfk_3` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`),
  CONSTRAINT `pruefungen_ibfk_4` FOREIGN KEY (`graduierung_vorher_id`) REFERENCES `graduierungen` (`graduierung_id`) ON DELETE SET NULL,
  CONSTRAINT `pruefungen_ibfk_5` FOREIGN KEY (`graduierung_nachher_id`) REFERENCES `graduierungen` (`graduierung_id`),
  CONSTRAINT `pruefungen_chk_1` CHECK (json_valid(`pruefungsinhalte`)),
  CONSTRAINT `pruefungen_chk_2` CHECK (json_valid(`einzelbewertungen`))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Erweiterte Prüfungsverwaltung mit Graduierungen';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefungen`
--

LOCK TABLES `pruefungen` WRITE;
/*!40000 ALTER TABLE `pruefungen` DISABLE KEYS */;
INSERT INTO `pruefungen` VALUES (3,74,5,2,47,63,'2025-12-15','Dojo',1,NULL,100.00,NULL,'',25.00,0,NULL,0,NULL,NULL,NULL,NULL,NULL,'bestanden',NULL,'2025-12-09 09:06:28','2025-12-15 07:08:14',NULL,'17:00:00','2025-12-14',NULL,NULL,NULL,0,NULL),(4,68,5,2,47,63,'2025-12-15','Dojo',1,NULL,100.00,NULL,'',25.00,0,NULL,1,'URK-2-2025-000004',NULL,NULL,NULL,NULL,'bestanden',NULL,'2025-12-09 09:06:33','2025-12-18 12:25:01',NULL,'17:00:00','2025-12-14',NULL,NULL,NULL,0,NULL),(5,78,5,2,47,63,'2025-12-15','Dojo',1,NULL,100.00,NULL,'',25.00,0,NULL,0,NULL,NULL,NULL,NULL,NULL,'bestanden',NULL,'2025-12-09 09:06:37','2025-12-15 20:35:53',NULL,'17:00:00','2025-12-14',NULL,NULL,NULL,0,NULL),(6,99,5,2,47,63,'2025-12-15','Dojo',1,NULL,100.00,NULL,'',25.00,0,NULL,0,NULL,NULL,NULL,NULL,NULL,'bestanden',NULL,'2025-12-10 12:16:54','2025-12-15 20:36:03',NULL,'17:00:00','2025-12-14',NULL,NULL,NULL,0,NULL),(7,84,5,2,47,63,'2025-12-15','Dojo',1,NULL,100.00,NULL,'',25.00,0,NULL,0,NULL,NULL,NULL,NULL,NULL,'bestanden',NULL,'2025-12-12 13:18:33','2025-12-15 20:36:12',NULL,'17:00:00','2025-12-14',NULL,NULL,NULL,0,NULL);
/*!40000 ALTER TABLE `pruefungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pruefungsinhalte`
--

DROP TABLE IF EXISTS `pruefungsinhalte`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pruefungsinhalte` (
  `inhalt_id` int NOT NULL AUTO_INCREMENT,
  `graduierung_id` int NOT NULL COMMENT 'Zugehörige Graduierung',
  `kategorie` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Kategorie (Grundtechniken, Kata, Kumite, etc.)',
  `titel` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Titel des Prüfungsinhalts',
  `beschreibung` text COLLATE utf8mb4_unicode_ci COMMENT 'Detaillierte Beschreibung',
  `reihenfolge` int NOT NULL DEFAULT '1' COMMENT 'Reihenfolge innerhalb der Kategorie',
  `pflicht` tinyint(1) DEFAULT '0' COMMENT 'Ist dieser Inhalt Pflicht für die Prüfung?',
  `aktiv` tinyint(1) DEFAULT '1' COMMENT 'Ist der Inhalt aktiv?',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`inhalt_id`),
  KEY `idx_inhalt_graduierung` (`graduierung_id`),
  KEY `idx_inhalt_kategorie` (`kategorie`),
  KEY `idx_inhalt_aktiv` (`aktiv`),
  KEY `idx_inhalt_reihenfolge` (`reihenfolge`),
  CONSTRAINT `pruefungsinhalte_ibfk_1` FOREIGN KEY (`graduierung_id`) REFERENCES `graduierungen` (`graduierung_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=121 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Prüfungsinhalte pro Graduierung';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefungsinhalte`
--

LOCK TABLES `pruefungsinhalte` WRITE;
/*!40000 ALTER TABLE `pruefungsinhalte` DISABLE KEYS */;
INSERT INTO `pruefungsinhalte` VALUES (11,47,'grundtechniken','Zenkutsu Dachi (Vorwärtsstellung)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(12,47,'grundtechniken','Oi Zuki (Fauststoß mit vorderem Arm)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(13,47,'theorie','Grundbegriffe: Rei, Hajime, Yame','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(14,47,'theorie','Bedeutung des weißen Gürtels','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(15,47,'theorie','Dojo-Kun (Verhaltensregeln)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(16,47,'grundtechniken','Gedan Barai (Abwehr nach unten)','',4,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(17,47,'kumite','Gohon Kumite (5-Schritt-Kumite)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(18,47,'kata','Taikyoku Shodan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(19,47,'grundtechniken','Soto Uke (Abwehr von außen nach innen)','',5,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(20,47,'grundtechniken','Age Uke (Abwehr nach oben)','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(21,48,'grundtechniken','Kokutsu Dachi (Rückwärtsstellung)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(22,48,'grundtechniken','Gyaku Zuki (Fauststoß mit hinterem Arm)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(23,48,'grundtechniken','Shuto Uke (Handkantenabwehr)','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(24,48,'grundtechniken','Mae Geri Keage/Kekomi','',4,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(25,48,'kata','Heian Shodan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(26,48,'kumite','Gohon Kumite (Jodan & Chudan)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(27,48,'theorie','Zählweise 1-20','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(28,48,'theorie','Bedeutung von \"Karate\"','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(29,48,'theorie','Name des Dojo-Leiters','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(30,50,'grundtechniken','Kiba Dachi (Reiterstellung)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(31,50,'grundtechniken','Empi Uchi (Ellbogenstoß)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(32,50,'grundtechniken','Ushiro Geri (Fußstoß rückwärts)','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(33,50,'grundtechniken','Uraken Uchi (Schlag mit Handrücken)','',4,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(34,50,'kata','Heian Sandan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(35,50,'kumite','Kihon Ippon Kumite (Jodan, Chudan)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(36,50,'theorie','Karate-Do Philosophie','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(37,50,'theorie','Alle bisherigen Kata benennen','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(38,51,'grundtechniken','Alle Grundtechniken in Meisterqualität','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(39,51,'grundtechniken','Freie Kombinationen mit höchster Präzision','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(40,51,'kata','Alle 5 Heian-Kata','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(41,51,'kata','Tekki Shodan','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(42,51,'kata','Bassai Dai','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(43,51,'kata','Kanku Dai','',4,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(44,51,'kata','Jion','',5,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(45,51,'kata','Enpi','',6,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(46,51,'kata','Hangetsu','',7,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(47,51,'kata','Eine Tokui-Kata (Lieblingskata)','',8,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(48,51,'kumite','Jiyu Kumite gegen mehrere Gegner','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(49,51,'kumite','Kumite mit wechselnden Partnern','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(50,51,'theorie','Geschichte des Karate und Shotokan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(51,51,'theorie','Philosophie und Dojo-Kun','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(52,51,'theorie','Bunkai zu allen geprüften Kata','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(53,51,'theorie','Fähigkeit zum Unterrichten','',4,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(54,62,'grundtechniken','Komplexe Kombinationen','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(55,62,'grundtechniken','Gedan Mawashi Geri','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(56,62,'kata','Tekki Shodan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(57,62,'grundtechniken','Mae Geri mit Richtungswechsel','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(58,62,'kumite','Jiyu Ippon Kumite (alle Angriffe)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(59,62,'theorie','Kata-Bedeutungen erklären','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(60,62,'theorie','Grundlagen Bunkai','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(61,63,'grundtechniken','Wiederholung Weißgurt-Programm','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(62,63,'grundtechniken','Mae Geri (Fußstoß vorwärts)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(63,63,'grundtechniken','Uchi Uke (Abwehr von innen nach außen)','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(64,63,'kata','Taikyoku Shodan (Wiederholung)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(65,63,'kumite','Gohon Kumite Jodan/Chudan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(66,63,'theorie','Zählweise 1-10 (japanisch)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(67,63,'theorie','Grundstellungen benennen','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(68,64,'grundtechniken','Alle Grundstellungen perfektioniert','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(69,64,'grundtechniken','Ren-Zuki (Doppelfauststoß)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(70,64,'grundtechniken','Mawashi Geri Jodan','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(71,64,'grundtechniken','Kombinationen mit Richtungswechsel','',4,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(72,64,'kata','Heian Godan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(73,64,'kumite','Kihon Ippon Kumite (alle Grundangriffe)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(74,64,'kumite','Einführung Jiyu Ippon Kumite','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(75,64,'theorie','Alle Heian-Kata demonstrieren können','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(76,64,'theorie','Prüfungsprogramm erklären','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(77,65,'grundtechniken','Alle Techniken in höchster Qualität','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(78,65,'grundtechniken','Freie Kombinationen','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(79,65,'kata','Eine Shitei-Kata nach Wahl','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(80,65,'kata','Bassai Dai oder Kanku Dai (Einführung)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(81,65,'kumite','Jiyu Ippon Kumite (fortgeschritten)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(82,65,'kumite','Einführung Jiyu Kumite','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(83,65,'theorie','Bunkai zu Heian-Kata','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(84,65,'theorie','Geschichte des Karate-Do','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(85,67,'grundtechniken','Yoko Geri Keage (Seitwärtsfußstoß schnappend)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(86,67,'grundtechniken','Yoko Geri Kekomi (Seitwärtsfußstoß stoßend)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(87,67,'grundtechniken','Mawashi Geri (Fußstoß halbrund)','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(88,67,'kata','Heian Nidan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(89,67,'kumite','Sanbon Kumite (3-Schritt-Kumite)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(90,67,'theorie','Meister Funakoshi Gichin','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(91,67,'theorie','Geschichte des Shotokan','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(92,68,'grundtechniken','Fudo Dachi','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(93,68,'grundtechniken','Teisho Uchi (Handballenstoß)','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(94,68,'grundtechniken','Kombinationen in verschiedenen Stellungen','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(95,68,'kata','Heian Yondan','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(96,68,'kumite','Kihon Ippon Kumite (Jodan, Chudan, Mae Geri)','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(97,68,'theorie','Dojo-Etikette erklären','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(98,68,'theorie','Bedeutung der Heian-Kata','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(99,69,'grundtechniken','Perfektionierte Grundtechniken','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(100,69,'grundtechniken','Alle Fußtechniken in Kombination','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(101,69,'kata','Alle Heian-Kata','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(102,69,'kata','Tekki Shodan','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(103,69,'kata','Bassai Dai oder Kanku Dai','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(104,69,'kumite','Jiyu Ippon Kumite gegen mehrere Angreifer','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(105,69,'kumite','Jiyu Kumite','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(106,69,'theorie','Bunkai demonstrieren können','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(107,69,'theorie','Philosophie des Karate-Do','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(108,69,'theorie','Prüfling kann bei Prüfungen assistieren','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(109,77,'grundtechniken','Meisterhafte Ausführung aller Techniken','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(110,77,'grundtechniken','Unterrichtsfähigkeit demonstrieren','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(111,77,'kata','Alle 1. Dan Kata','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(112,77,'kata','Jitte','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(113,77,'kata','Gankaku','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(114,77,'kata','Tekki Nidan','',4,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(115,77,'kata','Erweiterte Tokui-Kata','',5,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(116,77,'kumite','Freikampf auf hohem Niveau','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(117,77,'kumite','Demonstration von Kontrolle und Präzision','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(118,77,'theorie','Vertiefte Kata-Analyse und Bunkai','',1,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(119,77,'theorie','Lehrkompetenz nachweisen','',2,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34'),(120,77,'theorie','Geschichte der Meister','',3,1,1,'2025-12-14 13:10:34','2025-12-14 13:10:34');
/*!40000 ALTER TABLE `pruefungsinhalte` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pruefungstermin_vorlagen`
--

DROP TABLE IF EXISTS `pruefungstermin_vorlagen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pruefungstermin_vorlagen` (
  `termin_id` int NOT NULL AUTO_INCREMENT,
  `pruefungsdatum` date NOT NULL,
  `pruefungszeit` time DEFAULT '10:00:00',
  `pruefungsort` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pruefer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Name des Pr├╝fers',
  `stil_id` int NOT NULL,
  `pruefungsgebuehr` decimal(10,2) DEFAULT NULL,
  `anmeldefrist` date DEFAULT NULL,
  `bemerkungen` text COLLATE utf8mb4_unicode_ci,
  `teilnahmebedingungen` text COLLATE utf8mb4_unicode_ci,
  `dojo_id` int NOT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`termin_id`),
  KEY `idx_datum` (`pruefungsdatum`),
  KEY `idx_dojo` (`dojo_id`),
  KEY `idx_stil` (`stil_id`),
  CONSTRAINT `pruefungstermin_vorlagen_ibfk_1` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`) ON DELETE CASCADE,
  CONSTRAINT `pruefungstermin_vorlagen_ibfk_2` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefungstermin_vorlagen`
--

LOCK TABLES `pruefungstermin_vorlagen` WRITE;
/*!40000 ALTER TABLE `pruefungstermin_vorlagen` DISABLE KEYS */;
INSERT INTO `pruefungstermin_vorlagen` VALUES (4,'2025-12-15','17:00:00','Dojo','Sascha',5,25.00,'2025-12-14',NULL,NULL,2,'2025-12-06 08:21:43','2025-12-06 08:21:43');
/*!40000 ALTER TABLE `pruefungstermin_vorlagen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pruefungstermine`
--

DROP TABLE IF EXISTS `pruefungstermine`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pruefungstermine` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `pruefungsdatum` date NOT NULL,
  `startzeit` time DEFAULT NULL,
  `endzeit` time DEFAULT NULL,
  `ort` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `raum` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adresse` text COLLATE utf8mb4_unicode_ci,
  `gebuehren` decimal(10,2) DEFAULT '0.00',
  `zahlungsfrist` date DEFAULT NULL,
  `pruefer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organisator` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_teilnehmer` int DEFAULT '0',
  `min_teilnehmer` int DEFAULT '1',
  `anmeldeschluss` date DEFAULT NULL,
  `hinweise` text COLLATE utf8mb4_unicode_ci,
  `status` enum('geplant','offen','geschlossen','abgeschlossen','abgesagt') COLLATE utf8mb4_unicode_ci DEFAULT 'geplant',
  `dojo_id` int DEFAULT NULL,
  `stil_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stil` (`stil_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefungstermine`
--

LOCK TABLES `pruefungstermine` WRITE;
/*!40000 ALTER TABLE `pruefungstermine` DISABLE KEYS */;
/*!40000 ALTER TABLE `pruefungstermine` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_subscriptions`
--

DROP TABLE IF EXISTS `push_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `endpoint` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `p256dh_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_endpoint` (`endpoint`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_subscriptions`
--

LOCK TABLES `push_subscriptions` WRITE;
/*!40000 ALTER TABLE `push_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `push_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rabatte`
--

DROP TABLE IF EXISTS `rabatte`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rabatte` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `rabatt_prozent` int NOT NULL,
  `gueltig_von` date NOT NULL,
  `gueltig_bis` date NOT NULL,
  `max_nutzungen` int DEFAULT NULL,
  `genutzt` int DEFAULT '0',
  `aktiv` tinyint(1) DEFAULT '1',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `rabatte_chk_1` CHECK (((`rabatt_prozent` > 0) and (`rabatt_prozent` <= 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rabatte`
--

LOCK TABLES `rabatte` WRITE;
/*!40000 ALTER TABLE `rabatte` DISABLE KEYS */;
/*!40000 ALTER TABLE `rabatte` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `raeume`
--

DROP TABLE IF EXISTS `raeume`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `raeume` (
  `id` int NOT NULL AUTO_INCREMENT,
  `standort_id` int DEFAULT NULL,
  `dojo_id` int DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `groesse` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kapazitaet` int DEFAULT NULL,
  `farbe` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#4F46E5',
  `aktiv` tinyint(1) DEFAULT '1',
  `reihenfolge` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_raeume_aktiv` (`aktiv`),
  KEY `idx_raeume_reihenfolge` (`reihenfolge`),
  KEY `idx_raeume_standort_id` (`standort_id`),
  KEY `idx_raeume_dojo_id` (`dojo_id`),
  CONSTRAINT `fk_raeume_standort` FOREIGN KEY (`standort_id`) REFERENCES `standorte` (`standort_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `raeume`
--

LOCK TABLES `raeume` WRITE;
/*!40000 ALTER TABLE `raeume` DISABLE KEYS */;
INSERT INTO `raeume` VALUES (1,1,2,'Dojo','',NULL,NULL,'#4F46E5',1,1,'2025-12-02 09:13:40','2026-01-09 10:04:00');
/*!40000 ALTER TABLE `raeume` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rechnungen`
--

DROP TABLE IF EXISTS `rechnungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rechnungen` (
  `rechnung_id` int NOT NULL AUTO_INCREMENT,
  `rechnungsnummer` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mitglied_id` int NOT NULL,
  `datum` date NOT NULL,
  `rechnungsdatum` date DEFAULT NULL,
  `faelligkeitsdatum` date NOT NULL,
  `betrag` decimal(10,2) NOT NULL,
  `gesamtsumme` decimal(10,2) DEFAULT NULL,
  `netto_betrag` decimal(10,2) DEFAULT NULL,
  `brutto_betrag` decimal(10,2) DEFAULT NULL,
  `mwst_satz` decimal(5,2) DEFAULT '19.00',
  `mwst_betrag` decimal(10,2) DEFAULT NULL,
  `status` enum('offen','teilweise_bezahlt','bezahlt','ueberfaellig','storniert') COLLATE utf8mb4_unicode_ci DEFAULT 'offen',
  `bezahlt_am` date DEFAULT NULL,
  `zahlungsart` enum('bar','ueberweisung','lastschrift','kreditkarte','paypal') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `art` enum('mitgliedsbeitrag','pruefungsgebuehr','kursgebuehr','ausruestung','sonstiges') COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `notizen` text COLLATE utf8mb4_unicode_ci,
  `archiviert` tinyint(1) DEFAULT '0',
  `pdf_pfad` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dojo_id` int DEFAULT '1',
  `erstellt_von` int DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rechnung_id`),
  UNIQUE KEY `rechnungsnummer` (`rechnungsnummer`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_status` (`status`),
  KEY `idx_datum` (`datum`),
  KEY `idx_faelligkeit` (`faelligkeitsdatum`),
  KEY `idx_dojo` (`dojo_id`),
  KEY `idx_rechnungsnummer` (`rechnungsnummer`),
  CONSTRAINT `rechnungen_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rechnungen`
--

LOCK TABLES `rechnungen` WRITE;
/*!40000 ALTER TABLE `rechnungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `rechnungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rechnungspositionen`
--

DROP TABLE IF EXISTS `rechnungspositionen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rechnungspositionen` (
  `position_id` int NOT NULL AUTO_INCREMENT,
  `rechnung_id` int NOT NULL,
  `position_nr` int NOT NULL,
  `bezeichnung` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `menge` decimal(10,2) DEFAULT '1.00',
  `einzelpreis` decimal(10,2) NOT NULL,
  `gesamtpreis` decimal(10,2) NOT NULL,
  `mwst_satz` decimal(5,2) DEFAULT '19.00',
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`position_id`),
  KEY `idx_rechnung` (`rechnung_id`),
  CONSTRAINT `rechnungspositionen_ibfk_1` FOREIGN KEY (`rechnung_id`) REFERENCES `rechnungen` (`rechnung_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rechnungspositionen`
--

LOCK TABLES `rechnungspositionen` WRITE;
/*!40000 ALTER TABLE `rechnungspositionen` DISABLE KEYS */;
/*!40000 ALTER TABLE `rechnungspositionen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sepa_mandate`
--

DROP TABLE IF EXISTS `sepa_mandate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sepa_mandate` (
  `mandat_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `mandatsreferenz` varchar(35) COLLATE utf8mb4_unicode_ci NOT NULL,
  `glaeubiger_id` varchar(35) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DE98ZZZ09999999999',
  `erstellungsdatum` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('aktiv','widerrufen','abgelaufen') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aktiv',
  `iban` varchar(34) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bic` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kontoinhaber` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bankname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mandat_typ` enum('CORE','COR1','B2B') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CORE',
  `sequenz` enum('FRST','RCUR','OOFF','FNAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FRST',
  `widerruf_datum` datetime DEFAULT NULL,
  `ablaufdatum` date DEFAULT NULL,
  `letzte_nutzung` datetime DEFAULT NULL,
  `ersteller_user_id` int DEFAULT NULL,
  `pdf_pfad` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archiviert` tinyint(1) DEFAULT '0',
  `archiviert_am` datetime DEFAULT NULL,
  `archiviert_grund` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider` enum('manual_sepa','stripe_datev') COLLATE utf8mb4_unicode_ci DEFAULT 'manual_sepa' COMMENT 'Welches System das Mandat verwaltet',
  `stripe_setup_intent_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stripe Setup Intent f├╝r SEPA',
  `stripe_payment_method_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stripe Payment Method ID',
  PRIMARY KEY (`mandat_id`),
  UNIQUE KEY `mandatsreferenz` (`mandatsreferenz`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_status` (`status`),
  KEY `idx_mandatsreferenz` (`mandatsreferenz`),
  KEY `idx_provider` (`provider`),
  KEY `idx_stripe_payment_method` (`stripe_payment_method_id`),
  KEY `idx_sepa_mitglied` (`mitglied_id`),
  CONSTRAINT `sepa_mandate_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=137 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sepa_mandate`
--

LOCK TABLES `sepa_mandate` WRITE;
/*!40000 ALTER TABLE `sepa_mandate` DISABLE KEYS */;
INSERT INTO `sepa_mandate` VALUES (31,64,'MLREFM00012','DE98ZZZ09999999999','2024-12-12 00:00:00','aktiv','DE20743500000003075826','BYLADEM1LAH','Stefanie Barnert','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(32,65,'MLREFM00013','DE98ZZZ09999999999','2024-12-13 00:00:00','aktiv','DE54711510200000878512','BYLADEM1MDF','Tobias Sax','Sparkasse Altötting-Mühldorf','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(35,68,'MLREFM00016','DE98ZZZ09999999999','2025-01-28 00:00:00','aktiv','DE30743500000003054209','BYLADEM1LAH','Philipp Kraemer','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(36,69,'MLREFM00017','DE98ZZZ09999999999','2025-02-04 00:00:00','aktiv','DE33743923000003245047','GENODEF1VBV','George Purtan','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(38,71,'MLREFM00019','DE98ZZZ09999999999','2025-03-06 00:00:00','aktiv','DE74711510200031972375','BYLADEM1MDF','Lisa Liebermann','Sparkasse Altötting-Mühldorf','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(39,72,'MLREFM00020','DE98ZZZ09999999999','2025-02-24 00:00:00','aktiv','DE29700934000000236691','GENODEF1ISV','Bogdan Turlea','VR-Bank Ismaning Hallbergmoos Neufahrn','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(41,74,'MLREFM00022','DE98ZZZ09999999999','2025-05-02 00:00:00','aktiv','DE43701695660000421359','GENODEF1TAV','Anke Klinner','VR-Bank Taufkirchen-Dorfen','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(42,75,'MLREFM00023','DE98ZZZ09999999999','2025-04-24 00:00:00','aktiv','DE30500240243952731601','DEFFDEFFXXX','Tobias Bauer','C24 Bank','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(43,76,'MLREFM00024','DE98ZZZ09999999999','2025-04-05 00:00:00','aktiv','DE93740618130000317772','GENODEF1PFK','Rainer Beer','VR-Bank Rottal-Inn','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(44,77,'MLREFM00025','DE98ZZZ09999999999','2025-07-16 00:00:00','aktiv','DE49743500000004150937','BYLADEM1LAH','Alexandra Obermaier','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:15','2025-12-04 10:29:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(45,78,'MLREFM00026','DE98ZZZ09999999999','2025-08-01 00:00:00','aktiv','DE02743923000000077682','GENODEF1VBV','Rahim Noufal','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:16','2025-12-04 10:29:16',0,NULL,NULL,'manual_sepa',NULL,NULL),(46,79,'MLREFM00027','DE98ZZZ09999999999','2025-11-30 00:00:00','aktiv','DE16743500000003369129','BYLADEM1LAH','Tanja Lechner','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:16','2025-12-04 10:29:16',0,NULL,NULL,'manual_sepa',NULL,NULL),(47,80,'MLREFM00028','DE98ZZZ09999999999','2025-12-01 00:00:00','aktiv','DE78500105175450012564','INGDDEFFXXX','Dustin Feucht','ING-DiBa','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:16','2025-12-04 10:29:16',0,NULL,NULL,'manual_sepa',NULL,NULL),(48,81,'MLREFM00029','DE98ZZZ09999999999','2025-12-01 00:00:00','aktiv','DE84743923000003241025','GENODEF1VBV','Franz Josef Eidner','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:16','2025-12-04 10:29:16',0,NULL,NULL,'manual_sepa',NULL,NULL),(50,83,'MLREFM00030','DE98ZZZ09999999999','2025-11-26 00:00:00','aktiv','DE55711510200031306715','BYLADEM1MDF','Stefanie Demberger','Sparkasse Altötting-Mühldorf','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:16','2025-12-04 10:29:16',0,NULL,NULL,'manual_sepa',NULL,NULL),(51,84,'MLREFM00031','DE98ZZZ09999999999','2025-11-26 00:00:00','aktiv','DE04711600000007176139','GENODEF1VRR','Fabio Stauder','meine Volksbank Raiffeisenbank','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:16','2025-12-04 10:29:16',0,NULL,NULL,'manual_sepa',NULL,NULL),(54,87,'MLREFM00005','DE98ZZZ09999999999','2024-05-16 00:00:00','aktiv','DE37740618130002619814','GENODEF1PFK','Sebastian Kaltwasser','VR-Bank Rottal-Inn','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:17','2025-12-04 10:29:17',0,NULL,NULL,'manual_sepa',NULL,NULL),(55,88,'MLREFM00006','DE98ZZZ09999999999','2024-05-16 00:00:00','aktiv','DE93743923000000804320','GENODEF1VBV','Dominik Holzner','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:17','2025-12-04 10:29:17',0,NULL,NULL,'manual_sepa',NULL,NULL),(56,89,'MLREFM00007','DE98ZZZ09999999999','2024-05-16 00:00:00','aktiv','DE50743923000000419907','GENODEF1VBV','Nicole Reiter','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:18','2025-12-04 10:29:18',0,NULL,NULL,'manual_sepa',NULL,NULL),(57,90,'MLREFM00008','DE98ZZZ09999999999','2024-05-16 00:00:00','aktiv','DE50743923000000419907','GENODEF1VBV','Nicole Reiter','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-04 10:29:18','2025-12-04 10:29:18',0,NULL,NULL,'manual_sepa',NULL,NULL),(59,93,'MLREF100101','DE98ZZZ09999999999','2024-03-01 00:00:00','aktiv','DE60743923000000420891','GENODEF1VBV','Rosa Maria Dietrich','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:44','2025-12-07 21:14:44',0,NULL,NULL,'manual_sepa',NULL,NULL),(62,96,'MLREF100107','DE98ZZZ09999999999','2024-04-23 00:00:00','aktiv','DE39743200730016763616','HYVEDEMM433','Nina Ernst','UniCredit Bank - HypoVereinsbank','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:44','2025-12-07 21:14:44',0,NULL,NULL,'manual_sepa',NULL,NULL),(63,97,'MLREF100108','DE98ZZZ09999999999','2024-06-10 00:00:00','aktiv','DE45743923000000305537','GENODEF1VBV','Claudia Westenthanner','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:44','2025-12-07 21:14:44',0,NULL,NULL,'manual_sepa',NULL,NULL),(65,99,'MLREF100111','DE98ZZZ09999999999','2024-11-24 00:00:00','aktiv','DE24743900000008042039','GENODEF1LH1','Susanne Heider','VR-Bank Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:44','2025-12-07 21:14:44',0,NULL,NULL,'manual_sepa',NULL,NULL),(73,109,'MLREF100022','DE98ZZZ09999999999','2022-02-07 00:00:00','aktiv','DE24743923000000425516','GENODEF1VBV','Ulrich Dobos','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:45','2025-12-07 21:14:45',0,NULL,NULL,'manual_sepa',NULL,NULL),(75,111,'MLREF100046','DE98ZZZ09999999999','2022-07-18 00:00:00','aktiv','DE89743500000020745656','BYLADEM1LAH','Claudia Geier','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:45','2025-12-07 21:14:45',0,NULL,NULL,'manual_sepa',NULL,NULL),(76,112,'MLREF100018','DE98ZZZ09999999999','2022-02-07 00:00:00','aktiv','DE24743900000008042039','GENODEF1LH1','Marco Heider','VR-Bank Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:46','2025-12-07 21:14:46',0,NULL,NULL,'manual_sepa',NULL,NULL),(77,116,'MLREF100034','DE98ZZZ09999999999','2022-04-03 00:00:00','aktiv','DE56743923000000039365','GENODEF1VBV','Daniela Raiser','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:47','2025-12-07 21:14:47',0,NULL,NULL,'manual_sepa',NULL,NULL),(78,118,'MLREF100037','DE98ZZZ09999999999','2022-04-03 00:00:00','aktiv','DE91711510200000623512','BYLADEM1MDF','Judith Ramsauer','Sparkasse Altötting-Mühldorf','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:55','2025-12-07 21:14:55',0,NULL,NULL,'manual_sepa',NULL,NULL),(80,120,'MLREF100027','DE98ZZZ09999999999','2022-02-07 00:00:00','aktiv','DE87360100430608186436','PBNKDEFFXXX','Carmen Zuhmann','Postbank Ndl der Deutsche Bank','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:14:59','2025-12-07 21:14:59',0,NULL,NULL,'manual_sepa',NULL,NULL),(90,134,'MLREF100031','DE98ZZZ09999999999','2022-03-01 00:00:00','aktiv','DE57743900000008972257','GENODEF1LH1','Martin Priller','VR-Bank Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:02','2025-12-07 21:15:02',0,NULL,NULL,'manual_sepa',NULL,NULL),(95,140,'MLREF100113','DE98ZZZ09999999999','2025-02-06 00:00:00','aktiv','DE07743500000021192847','BYLADEM1LAH','Leonard Kern','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:04','2025-12-07 21:15:04',0,NULL,NULL,'manual_sepa',NULL,NULL),(98,143,'MLREF100052','DE98ZZZ09999999999','2022-09-22 00:00:00','aktiv','DE93700519950020610382','BYLADEM1ERD','Daniela Aufinger','Kreis- und Stadtsparkasse Erding-Dorfen','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:06','2025-12-07 21:15:06',0,NULL,NULL,'manual_sepa',NULL,NULL),(99,146,'MLREF100059','DE98ZZZ09999999999','2022-09-30 00:00:00','aktiv','DE10743500000004295005','BYLADEM1LAH','Lydia Bichlmaier','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:07','2025-12-07 21:15:07',0,NULL,NULL,'manual_sepa',NULL,NULL),(100,148,'MLREF100060','DE98ZZZ09999999999','2022-10-05 00:00:00','aktiv','DE85740618130006910521','GENODEF1PFK','Stefanie Dirnaichner','VR-Bank Rottal-Inn','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:07','2025-12-07 21:15:07',0,NULL,NULL,'manual_sepa',NULL,NULL),(101,149,'MLREF100061','DE98ZZZ09999999999','2022-10-05 00:00:00','aktiv','DE96120300001031179409','BYLADEM1001','Julia Lermer','Deutsche Kreditbank Berlin','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:08','2025-12-07 21:15:08',0,NULL,NULL,'manual_sepa',NULL,NULL),(104,153,'MLREF100065','DE98ZZZ09999999999','2022-11-04 00:00:00','aktiv','DE53740618130004809980','GENODEF1PFK','Christoph Vierlbeck','VR-Bank Rottal-Inn','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:09','2025-12-07 21:15:09',0,NULL,NULL,'manual_sepa',NULL,NULL),(112,164,'MLREF100074','DE98ZZZ09999999999','2023-03-13 00:00:00','aktiv','DE09743500000020856318','BYLADEM1LAH','Robert Biro','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:11','2025-12-07 21:15:11',0,NULL,NULL,'manual_sepa',NULL,NULL),(113,166,'MLREF100077','DE98ZZZ09999999999','2023-03-14 00:00:00','aktiv','DE57700905000005504058','GENODEF1S04','Elisabeth Erdmann','Sparda-Bank München','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:12','2025-12-07 21:15:12',0,NULL,NULL,'manual_sepa',NULL,NULL),(115,168,'MLREF100080','DE98ZZZ09999999999','2023-07-12 00:00:00','aktiv','DE89743500000021166927','BYLADEM1LAH','Jonas Holzner','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:13','2025-12-07 21:15:13',0,NULL,NULL,'manual_sepa',NULL,NULL),(116,169,'MLREF100081','DE98ZZZ09999999999','2023-07-31 00:00:00','aktiv','DE25743923000000888770','GENODEF1VBV','Isabella Santangelo','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:13','2025-12-07 21:15:13',0,NULL,NULL,'manual_sepa',NULL,NULL),(117,170,'MLREF100083','DE98ZZZ09999999999','2023-10-25 00:00:00','aktiv','DE30743923000000422983','GENODEF1VBV','Sybille Sprung','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:13','2025-12-07 21:15:13',0,NULL,NULL,'manual_sepa',NULL,NULL),(119,172,'MLREF100084','DE98ZZZ09999999999','2023-11-07 00:00:00','aktiv','DE96711510200031386972','BYLADEM1MDF','Anna Geiringer','Sparkasse Altötting-Mühldorf','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:14','2025-12-07 21:15:14',0,NULL,NULL,'manual_sepa',NULL,NULL),(120,173,'MLREF100085','DE98ZZZ09999999999','2023-11-12 00:00:00','aktiv','DE39743923000000301183','GENODEF1VBV','Manfred und Sabine Geltinger','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:14','2025-12-07 21:15:14',0,NULL,NULL,'manual_sepa',NULL,NULL),(121,174,'MLREF100112','DE98ZZZ09999999999','2025-02-04 00:00:00','aktiv','DE52740618130000331023','GENODEF1PFK','Tim Brandmeier','VR-Bank Rottal-Inn','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:15','2025-12-07 21:15:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(123,175,'MLREF100087','DE98ZZZ09999999999','2023-11-13 00:00:00','aktiv','DE69743900000008912580','GENODEF1LH1','Tina HeyHerbst','VR-Bank Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:15','2025-12-07 21:15:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(125,177,'MLREF100089','DE98ZZZ09999999999','2023-11-22 00:00:00','aktiv','DE05500105175409227027','INGDDEFFXXX','Sandra Huber','ING-DiBa','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:15','2025-12-07 21:15:15',0,NULL,NULL,'manual_sepa',NULL,NULL),(127,179,'MLREF100090','DE98ZZZ09999999999','2023-11-28 00:00:00','aktiv','DE75743923000000884863','GENODEF1VBV','Stefan Huber','VR-Bank Isar-Vils','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:16','2025-12-07 21:15:16',0,NULL,NULL,'manual_sepa',NULL,NULL),(132,185,'MLREF100096','DE98ZZZ09999999999','2024-02-07 00:00:00','aktiv','DE44120300001013599095','BYLADEM1001','Johanna Dauner','Deutsche Kreditbank Berlin','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:15:17','2025-12-07 21:15:17',0,NULL,NULL,'manual_sepa',NULL,NULL),(136,152,'DOJO3-152-1765542083306','DE98ZZZ09999999999','2025-12-12 13:21:23','aktiv','DE61743500000020362137','BYLADEM1LAH','Sascha Theil','Sparkasse Landshut','CORE','FRST',NULL,NULL,NULL,NULL,NULL,'2025-12-12 12:21:23','2025-12-12 12:21:23',0,NULL,NULL,'manual_sepa',NULL,NULL);
/*!40000 ALTER TABLE `sepa_mandate` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `standorte`
--

DROP TABLE IF EXISTS `standorte`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `standorte` (
  `standort_id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int NOT NULL COMMENT 'Welchem Tenant/Dojo gehört dieser Standort',
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Standort-Name (z.B. "Hauptstandort", "Filiale Nord")',
  `ist_hauptstandort` tinyint(1) DEFAULT '0' COMMENT 'Ist dies der Hauptstandort?',
  `sortierung` int DEFAULT '0' COMMENT 'Sortierreihenfolge für UI',
  `farbe` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#4F46E5' COMMENT 'Farbe für UI-Identifikation',
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hausnummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plz` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `land` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Deutschland',
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oeffnungszeiten` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Öffnungszeiten pro Wochentag + Ausnahmen',
  `ist_aktiv` tinyint(1) DEFAULT '1',
  `notizen` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`standort_id`),
  KEY `idx_standorte_dojo_id` (`dojo_id`),
  KEY `idx_standorte_aktiv` (`ist_aktiv`),
  KEY `idx_standorte_sortierung` (`sortierung`),
  KEY `idx_standorte_hauptstandort` (`ist_hauptstandort`),
  CONSTRAINT `fk_standorte_dojo` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_standorte_farbe` CHECK (regexp_like(`farbe`,_utf8mb4'^#[0-9A-Fa-f]{6}$')),
  CONSTRAINT `standorte_chk_1` CHECK (json_valid(`oeffnungszeiten`))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Standorte/Filialen eines Dojos für Multi-Location Management';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `standorte`
--

LOCK TABLES `standorte` WRITE;
/*!40000 ALTER TABLE `standorte` DISABLE KEYS */;
INSERT INTO `standorte` VALUES (1,2,'Tiger & Dragon Association - International - Hauptstandort',1,0,'#FFD700','Geigelsteinstr. ','14','84137','Vilsbbiburg','Deutschland','015752461776','headquarter@tda-intl.com',NULL,1,NULL,'2026-01-09 10:04:00','2026-01-09 10:04:00'),(2,3,'Kampfsportschule Schreiner - Hauptstandort',1,0,'#FFD700','','','','Vilsbbiburg','Deutschland','015752461776','info@tda-vib.de',NULL,1,NULL,'2026-01-09 10:04:00','2026-01-09 10:04:00'),(3,4,'demo - Hauptstandort',1,0,'#FFD700',NULL,NULL,NULL,NULL,'Deutschland','','demo@zugang.de',NULL,1,NULL,'2026-01-09 10:04:00','2026-01-09 10:04:00');
/*!40000 ALTER TABLE `standorte` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stile`
--

DROP TABLE IF EXISTS `stile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stile` (
  `stil_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `aktiv` tinyint(1) DEFAULT '1',
  `reihenfolge` int DEFAULT '0',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `wartezeit_grundstufe` int DEFAULT '3' COMMENT 'Wartezeit in Monaten fÃ¼r Grundstufen-PrÃ¼fungen',
  `wartezeit_mittelstufe` int DEFAULT '4' COMMENT 'Wartezeit in Monaten fÃ¼r Mittelstufen-PrÃ¼fungen',
  `wartezeit_oberstufe` int DEFAULT '6' COMMENT 'Wartezeit in Monaten fÃ¼r Oberstufen-PrÃ¼fungen',
  `wartezeit_schwarzgurt_traditionell` tinyint(1) DEFAULT '0' COMMENT 'Ob traditionelle DAN-Wartezeiten verwendet werden',
  PRIMARY KEY (`stil_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stile`
--

LOCK TABLES `stile` WRITE;
/*!40000 ALTER TABLE `stile` DISABLE KEYS */;
INSERT INTO `stile` VALUES (2,'ShieldX','Moderne Selbstverteidigung mit realistischen Szenarien',1,0,'2025-08-25 05:11:38','2025-12-04 15:09:57',3,4,6,0),(3,'BJJ','',0,1,'2025-08-25 05:11:38','2025-11-29 08:46:44',3,4,6,0),(4,'Kickboxen','',1,NULL,'2025-08-25 05:11:38','2025-12-05 16:21:01',3,4,6,0),(5,'Enso Karate','Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken',1,NULL,'2025-08-25 05:11:38','2025-12-18 20:18:24',3,4,6,1),(7,'Taekwon-Do','Koreanische Kampfkunst mit Betonung auf Fußtechniken und hohe Tritte',0,6,'2025-08-25 05:11:38','2025-11-28 21:55:02',3,4,6,0),(8,'Brazilian Jiu-Jitsu','Brasilianisches Jiu-Jitsu - Bodenkampf und Grappling-Techniken',0,3,'2025-08-25 05:11:38','2025-11-28 21:54:53',3,4,6,0),(18,'test','',0,7,'2025-09-08 16:21:04','2025-12-04 15:13:38',3,4,6,0),(20,'Brazilian Jiu Jitsu','',1,5,'2025-12-02 08:45:00','2025-12-02 09:02:17',3,4,6,0);
/*!40000 ALTER TABLE `stile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stripe_payment_intents`
--

DROP TABLE IF EXISTS `stripe_payment_intents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_payment_intents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `stripe_payment_intent_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Stripe Payment Intent ID',
  `amount` int NOT NULL COMMENT 'Betrag in Cent',
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT 'EUR',
  `status` enum('requires_payment_method','requires_confirmation','requires_action','processing','requires_capture','canceled','succeeded','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'requires_payment_method',
  `mandate_reference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SEPA Mandatsreferenz f├╝r Stripe',
  `payment_method_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stripe Payment Method ID',
  `invoice_reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Rechnungsreferenz',
  `description` text COLLATE utf8mb4_unicode_ci,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Zus├ñtzliche Stripe Metadaten',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_payment_intent_id` (`stripe_payment_intent_id`),
  KEY `idx_stripe_payment_intent` (`stripe_payment_intent_id`),
  KEY `idx_mitglied_status` (`mitglied_id`,`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `stripe_payment_intents_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `stripe_payment_intents_chk_1` CHECK (json_valid(`metadata`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stripe Payment Intents f├╝r SEPA Lastschriften';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stripe_payment_intents`
--

LOCK TABLES `stripe_payment_intents` WRITE;
/*!40000 ALTER TABLE `stripe_payment_intents` DISABLE KEYS */;
/*!40000 ALTER TABLE `stripe_payment_intents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stripe_webhooks`
--

DROP TABLE IF EXISTS `stripe_webhooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_webhooks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stripe_event_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'payment_intent.succeeded, etc.',
  `processed` tinyint(1) DEFAULT '0',
  `payment_intent_id` int DEFAULT NULL,
  `webhook_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `processing_error` text COLLATE utf8mb4_unicode_ci,
  `received_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_event_id` (`stripe_event_id`),
  KEY `payment_intent_id` (`payment_intent_id`),
  KEY `idx_event_id` (`stripe_event_id`),
  KEY `idx_processed` (`processed`),
  KEY `idx_event_type` (`event_type`),
  CONSTRAINT `stripe_webhooks_ibfk_1` FOREIGN KEY (`payment_intent_id`) REFERENCES `stripe_payment_intents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stripe_webhooks_chk_1` CHECK (json_valid(`webhook_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stripe Webhook Events f├╝r Payment Processing';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stripe_webhooks`
--

LOCK TABLES `stripe_webhooks` WRITE;
/*!40000 ALTER TABLE `stripe_webhooks` DISABLE KEYS */;
/*!40000 ALTER TABLE `stripe_webhooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stundenplan`
--

DROP TABLE IF EXISTS `stundenplan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stundenplan` (
  `stundenplan_id` int NOT NULL AUTO_INCREMENT,
  `tag` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uhrzeit_start` time NOT NULL,
  `uhrzeit_ende` time NOT NULL,
  `kurs_id` int DEFAULT NULL,
  `standort_id` int DEFAULT NULL,
  `trainer_id` int DEFAULT NULL,
  `raum_id` int DEFAULT NULL COMMENT 'Zugeordneter Raum für diesen Stundenplan-Eintrag',
  PRIMARY KEY (`stundenplan_id`),
  KEY `fk_stundenplan_kurs` (`kurs_id`),
  KEY `idx_stundenplan_raum` (`raum_id`),
  KEY `idx_stundenplan_standort_id` (`standort_id`),
  CONSTRAINT `fk_stundenplan_kurs` FOREIGN KEY (`kurs_id`) REFERENCES `kurse` (`kurs_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stundenplan_raum` FOREIGN KEY (`raum_id`) REFERENCES `raeume` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_stundenplan_standort` FOREIGN KEY (`standort_id`) REFERENCES `standorte` (`standort_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stundenplan`
--

LOCK TABLES `stundenplan` WRITE;
/*!40000 ALTER TABLE `stundenplan` DISABLE KEYS */;
INSERT INTO `stundenplan` VALUES (19,'Montag','17:15:00','17:45:00',16,2,NULL,1),(20,'Montag','17:45:00','18:30:00',17,2,NULL,1),(21,'Montag','18:45:00','19:45:00',18,2,NULL,1),(22,'Mittwoch','17:15:00','18:15:00',19,2,NULL,1),(23,'Dienstag','16:00:00','16:30:00',16,2,NULL,1),(24,'Dienstag','16:30:00','17:00:00',22,2,NULL,1),(25,'Dienstag','17:00:00','17:45:00',23,2,NULL,1),(26,'Dienstag','17:45:00','18:30:00',24,2,NULL,1),(27,'Dienstag','18:30:00','19:30:00',28,2,NULL,1),(29,'Mittwoch','18:30:00','19:15:00',21,2,NULL,1),(30,'Mittwoch','19:30:00','20:30:00',27,2,NULL,1),(31,'Donnerstag','17:30:00','18:00:00',25,2,NULL,1),(32,'Donnerstag','18:00:00','18:45:00',23,2,NULL,1),(33,'Donnerstag','19:00:00','20:00:00',26,2,NULL,1),(34,'Donnerstag','20:00:00','20:30:00',27,2,NULL,1),(35,'Montag','20:00:00','20:30:00',21,2,NULL,1);
/*!40000 ALTER TABLE `stundenplan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscription_audit_log`
--

DROP TABLE IF EXISTS `subscription_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_audit_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `subscription_id` int NOT NULL,
  `dojo_id` int NOT NULL,
  `action` enum('created','upgraded','downgraded','cancelled','reactivated','suspended','feature_enabled','feature_disabled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_plan` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_plan` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by_admin_id` int DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_subscription` (`subscription_id`),
  KEY `idx_dojo` (`dojo_id`),
  KEY `idx_action` (`action`),
  CONSTRAINT `subscription_audit_log_ibfk_1` FOREIGN KEY (`subscription_id`) REFERENCES `dojo_subscriptions` (`subscription_id`) ON DELETE CASCADE,
  CONSTRAINT `subscription_audit_log_ibfk_2` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscription_audit_log`
--

LOCK TABLES `subscription_audit_log` WRITE;
/*!40000 ALTER TABLE `subscription_audit_log` DISABLE KEYS */;
INSERT INTO `subscription_audit_log` VALUES (1,4,4,'created',NULL,'starter',NULL,'Neue Dojo-Registrierung','2026-01-06 06:05:13');
/*!40000 ALTER TABLE `subscription_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscription_plans`
--

DROP TABLE IF EXISTS `subscription_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_plans` (
  `plan_id` int NOT NULL AUTO_INCREMENT,
  `plan_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price_monthly` decimal(10,2) NOT NULL,
  `price_yearly` decimal(10,2) NOT NULL,
  `feature_verkauf` tinyint(1) DEFAULT '0',
  `feature_buchfuehrung` tinyint(1) DEFAULT '0',
  `feature_events` tinyint(1) DEFAULT '0',
  `feature_multidojo` tinyint(1) DEFAULT '0',
  `feature_api` tinyint(1) DEFAULT '0',
  `max_members` int NOT NULL,
  `max_dojos` int DEFAULT '1',
  `storage_limit_mb` int DEFAULT '1000',
  `sort_order` int DEFAULT '0',
  `is_visible` tinyint(1) DEFAULT '1',
  `is_deprecated` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`plan_id`),
  UNIQUE KEY `plan_name` (`plan_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscription_plans`
--

LOCK TABLES `subscription_plans` WRITE;
/*!40000 ALTER TABLE `subscription_plans` DISABLE KEYS */;
INSERT INTO `subscription_plans` VALUES (1,'starter','Starter','Perfekt für kleine Dojos und Neugründungen',49.00,490.00,0,0,0,0,0,100,1,1000,1,1,0,'2026-01-05 16:31:20','2026-01-05 16:31:20'),(2,'professional','Professional','Für etablierte Kampfsportschulen',89.00,890.00,1,0,1,0,0,300,1,5000,2,1,0,'2026-01-05 16:31:20','2026-01-05 16:31:20'),(3,'premium','Premium','Alle Features für professionelle Dojos',149.00,1490.00,1,1,1,0,1,999999,1,20000,3,1,0,'2026-01-05 16:31:20','2026-01-05 16:31:20'),(4,'enterprise','Enterprise','Für Dojo-Ketten und mehrere Standorte',249.00,2490.00,1,1,1,1,1,999999,3,50000,4,1,0,'2026-01-05 16:31:20','2026-01-05 16:31:20');
/*!40000 ALTER TABLE `subscription_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tarife`
--

DROP TABLE IF EXISTS `tarife`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tarife` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int DEFAULT '1',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_cents` int NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EUR',
  `duration_months` int NOT NULL,
  `billing_cycle` enum('MONTHLY','QUARTERLY','YEARLY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` set('SEPA','CARD','PAYPAL','BANK_TRANSFER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `altersgruppe` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mindestlaufzeit_monate` int DEFAULT NULL,
  `kuendigungsfrist_monate` int DEFAULT '3',
  `aufnahmegebuehr_cents` int NOT NULL DEFAULT '4999' COMMENT 'AufnahmegebÃ¼hr in Cents (z.B. 4999 = 49,99 EUR)',
  `ist_archiviert` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE = Alter Tarif, nicht mehr für neue Mitglieder verfügbar',
  PRIMARY KEY (`id`),
  KEY `idx_tarife_archiviert` (`ist_archiviert`),
  KEY `idx_dojo_id` (`dojo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tarife`
--

LOCK TABLES `tarife` WRITE;
/*!40000 ALTER TABLE `tarife` DISABLE KEYS */;
INSERT INTO `tarife` VALUES (19,3,'Kinder & Jugendliche 3 Monate',7500,'EUR',3,'MONTHLY','SEPA',1,'Kinder & Jugendliche',3,3,4999,0),(20,3,'Kinder & Jugendliche 6 Monate',6500,'EUR',6,'MONTHLY','SEPA',1,'Kinder & Jugendliche',6,3,4999,0),(21,3,'Kinder & Jugendliche 12 Monate',4900,'EUR',12,'MONTHLY','SEPA',1,'Kinder & Jugendliche',12,3,4999,0),(22,3,'Erwachsene 3 Monate',9500,'EUR',3,'MONTHLY','SEPA',1,'Erwachsene',3,3,4999,0),(23,3,'Erwachsene 6 Monate',8500,'EUR',6,'MONTHLY','SEPA',1,'Erwachsene',6,3,4999,0),(24,3,'Erwachsene 12 Monate',6900,'EUR',12,'MONTHLY','SEPA',1,'Erwachsene',12,3,4999,0),(25,3,'Studenten & Schüler 3 Monate',7500,'EUR',3,'MONTHLY','SEPA',1,'Studenten & Schüler',3,3,4999,0),(26,3,'Studenten & Schüler 6 Monate',6500,'EUR',6,'MONTHLY','SEPA',1,'Studenten & Schüler',6,3,4999,0),(27,3,'Studenten & Schüler 12 Monate',4900,'EUR',12,'MONTHLY','SEPA',1,'Studenten & Schüler',12,3,4999,0),(28,3,'Kids',3499,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(29,3,'Kids neu',4900,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(30,3,'Erwachsene neu',6900,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(31,3,'Erwachsene',6499,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(32,3,'Kids ab 2024',3499,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(33,3,'Erwachsene ab 2024',5499,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(34,3,'Kinder/Jugendliche & Schüler/Studenten',2999,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(35,3,'2.Familienmitglied Kinder/Jugendliche & Schüler/Studenten',2499,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(36,3,'TKD Anzug',3999,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,0),(37,3,'Familientarif',8687,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,0),(38,3,'3.Familienmitglied Erwachsene',0,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,0),(39,3,'Beitragsfrei',0,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,0),(40,3,'Studenten ab 2024',3499,'EUR',1,'MONTHLY','SEPA',1,NULL,NULL,3,4999,1),(41,3,'10er Karte Kids',12000,'EUR',6,'MONTHLY','BANK_TRANSFER',1,'Kinder',0,0,0,0),(42,3,'10er Karte SchÃ¼ler',12000,'EUR',6,'MONTHLY','BANK_TRANSFER',1,'SchÃ¼ler',0,0,0,0),(43,3,'10er Karte Erwachsene',16000,'EUR',6,'MONTHLY','BANK_TRANSFER',1,'Erwachsene',0,0,0,0);
/*!40000 ALTER TABLE `tarife` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `termin_teilnehmer`
--

DROP TABLE IF EXISTS `termin_teilnehmer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `termin_teilnehmer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `termin_id` int DEFAULT NULL,
  `mitglied_id` int DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'angemeldet',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `termin_teilnehmer`
--

LOCK TABLES `termin_teilnehmer` WRITE;
/*!40000 ALTER TABLE `termin_teilnehmer` DISABLE KEYS */;
/*!40000 ALTER TABLE `termin_teilnehmer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `termine`
--

DROP TABLE IF EXISTS `termine`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `termine` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `typ` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_datum` datetime DEFAULT NULL,
  `end_datum` datetime DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'geplant',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `termine`
--

LOCK TABLES `termine` WRITE;
/*!40000 ALTER TABLE `termine` DISABLE KEYS */;
INSERT INTO `termine` VALUES (1,'Weihnachtsfeier 2024','feier','2024-12-15 18:00:00','2024-12-15 22:00:00','geplant'),(2,'Dan-Prüfung','pruefung','2025-03-15 10:00:00','2025-03-15 16:00:00','geplant');
/*!40000 ALTER TABLE `termine` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trainer`
--

DROP TABLE IF EXISTS `trainer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainer` (
  `trainer_id` int NOT NULL AUTO_INCREMENT,
  `vorname` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nachname` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(25) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stil` enum('Kickboxen','Karate','ShieldX','BJJ') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Kickboxen',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`trainer_id`),
  KEY `idx_trainer_dojo_id` (`dojo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trainer`
--

LOCK TABLES `trainer` WRITE;
/*!40000 ALTER TABLE `trainer` DISABLE KEYS */;
INSERT INTO `trainer` VALUES (2,'Sascha','Schreiner','info@tda-intl.com','04915752461776','Kickboxen',1),(3,'Stefan','Jeschke','','','Kickboxen',1),(4,'Stephanie','Schreiner','headquarter@tda-intl.com','','Kickboxen',1),(10,'Judith','Westenthanner-Ramsauer','','','Kickboxen',1);
/*!40000 ALTER TABLE `trainer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trainer_standorte`
--

DROP TABLE IF EXISTS `trainer_standorte`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainer_standorte` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trainer_id` int NOT NULL,
  `standort_id` int NOT NULL,
  `ist_hauptstandort` tinyint(1) DEFAULT '0' COMMENT 'Ist dies der Hauptstandort des Trainers?',
  `aktiv` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_trainer_standort` (`trainer_id`,`standort_id`),
  KEY `idx_trainer_standorte_trainer` (`trainer_id`),
  KEY `idx_trainer_standorte_standort` (`standort_id`),
  KEY `idx_trainer_standorte_aktiv` (`aktiv`),
  CONSTRAINT `fk_trainer_standorte_standort` FOREIGN KEY (`standort_id`) REFERENCES `standorte` (`standort_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_trainer_standorte_trainer` FOREIGN KEY (`trainer_id`) REFERENCES `trainer` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='M:N Zuordnung von Trainern zu Standorten';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trainer_standorte`
--

LOCK TABLES `trainer_standorte` WRITE;
/*!40000 ALTER TABLE `trainer_standorte` DISABLE KEYS */;
/*!40000 ALTER TABLE `trainer_standorte` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trainer_stile`
--

DROP TABLE IF EXISTS `trainer_stile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainer_stile` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trainer_id` int NOT NULL,
  `stil` enum('Kickboxen','Karate','ShieldX','BJJ') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `trainer_id` (`trainer_id`),
  CONSTRAINT `trainer_stile_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `trainer` (`trainer_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trainer_stile`
--

LOCK TABLES `trainer_stile` WRITE;
/*!40000 ALTER TABLE `trainer_stile` DISABLE KEYS */;
INSERT INTO `trainer_stile` VALUES (1,2,'Kickboxen'),(2,2,'Karate'),(3,2,'ShieldX'),(4,3,'Kickboxen'),(5,3,'Karate'),(6,3,'ShieldX'),(7,3,'BJJ'),(8,4,'Kickboxen'),(9,4,'Karate'),(10,4,'ShieldX');
/*!40000 ALTER TABLE `trainer_stile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trainings_notizen`
--

DROP TABLE IF EXISTS `trainings_notizen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainings_notizen` (
  `notiz_id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `trainer_id` int DEFAULT NULL,
  `titel` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notiz` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `typ` enum('allgemein','staerke','schwaeche','verbesserung','verletzung','sonstiges') COLLATE utf8mb4_unicode_ci DEFAULT 'allgemein',
  `privat` tinyint(1) DEFAULT '0',
  `datum` date NOT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notiz_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_datum` (`datum`),
  KEY `idx_typ` (`typ`),
  CONSTRAINT `trainings_notizen_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trainings_notizen`
--

LOCK TABLES `trainings_notizen` WRITE;
/*!40000 ALTER TABLE `trainings_notizen` DISABLE KEYS */;
/*!40000 ALTER TABLE `trainings_notizen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaktionen`
--

DROP TABLE IF EXISTS `transaktionen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaktionen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `typ` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `betrag` decimal(10,2) DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'offen',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaktionen`
--

LOCK TABLES `transaktionen` WRITE;
/*!40000 ALTER TABLE `transaktionen` DISABLE KEYS */;
/*!40000 ALTER TABLE `transaktionen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'admin',
  `mitglied_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `security_question` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `security_answer_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_mitglied_id` (`mitglied_id`),
  CONSTRAINT `fk_users_mitglied` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@tda-intl.org','$2b$10$xeTdpRiwFw6yGFMXJM2VT.xSriFN4k7das8KdXMoNbplza8NbOOGa','admin',NULL,'2025-11-15 19:01:07',NULL,NULL),(2,'Sam666','headquarter@tda-intl.com','$2b$10$rJsJuUUmfvMkhw2SnjxCKOSudTttL7LZyX1/chU./1uJgtDIEERVW','member',1,'2025-11-28 08:53:22',NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `verkaeufe`
--

DROP TABLE IF EXISTS `verkaeufe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verkaeufe` (
  `verkauf_id` int NOT NULL AUTO_INCREMENT,
  `bon_nummer` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kassen_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'KASSE_01',
  `mitglied_id` int DEFAULT NULL,
  `kunde_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verkauf_datum` date NOT NULL,
  `verkauf_uhrzeit` time NOT NULL,
  `verkauf_timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `netto_gesamt_cent` int NOT NULL DEFAULT '0',
  `mwst_gesamt_cent` int NOT NULL DEFAULT '0',
  `brutto_gesamt_cent` int NOT NULL DEFAULT '0',
  `zahlungsart` enum('bar','karte','digital','gutschein') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bar',
  `gegeben_cent` int DEFAULT NULL,
  `rueckgeld_cent` int DEFAULT NULL,
  `verkauft_von` int DEFAULT NULL,
  `verkauft_von_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tse_signatur` text COLLATE utf8mb4_unicode_ci,
  `tse_zeitstempel` timestamp NULL DEFAULT NULL,
  `tse_transaction_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storniert` tinyint(1) DEFAULT '0',
  `storno_grund` text COLLATE utf8mb4_unicode_ci,
  `storno_timestamp` timestamp NULL DEFAULT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`verkauf_id`),
  UNIQUE KEY `bon_nummer` (`bon_nummer`),
  KEY `idx_bon_nummer` (`bon_nummer`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_datum` (`verkauf_datum`),
  KEY `idx_timestamp` (`verkauf_timestamp`),
  KEY `idx_kasse` (`kassen_id`),
  KEY `idx_verkaeufe_datum_art` (`verkauf_datum`,`zahlungsart`),
  CONSTRAINT `verkaeufe_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `verkaeufe`
--

LOCK TABLES `verkaeufe` WRITE;
/*!40000 ALTER TABLE `verkaeufe` DISABLE KEYS */;
/*!40000 ALTER TABLE `verkaeufe` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `verkauf_einstellungen`
--

DROP TABLE IF EXISTS `verkauf_einstellungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verkauf_einstellungen` (
  `einstellung_id` int NOT NULL AUTO_INCREMENT,
  `schluessel` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wert` text COLLATE utf8mb4_unicode_ci,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`einstellung_id`),
  UNIQUE KEY `schluessel` (`schluessel`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `verkauf_einstellungen`
--

LOCK TABLES `verkauf_einstellungen` WRITE;
/*!40000 ALTER TABLE `verkauf_einstellungen` DISABLE KEYS */;
INSERT INTO `verkauf_einstellungen` VALUES (1,'kassen_id','KASSE_01','Standard-Kassen-ID','2025-10-18 04:04:42','2025-10-18 04:04:42'),(2,'mwst_normal','19.00','Normaler MwSt-Satz in Prozent','2025-10-18 04:04:42','2025-10-18 04:04:42'),(3,'mwst_ermaeßigt','7.00','Ermäßigter MwSt-Satz in Prozent','2025-10-18 04:04:42','2025-10-18 04:04:42'),(4,'bon_prefix','DOJO','Präfix für Bonnummern','2025-10-18 04:04:42','2025-10-18 04:04:42'),(5,'lager_warnung','5','Mindestbestand für Warnung','2025-10-18 04:04:42','2025-10-18 04:04:42'),(6,'auto_lager_tracking','true','Automatisches Lager-Tracking aktivieren','2025-10-18 04:04:42','2025-10-18 04:04:42');
/*!40000 ALTER TABLE `verkauf_einstellungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `verkauf_positionen`
--

DROP TABLE IF EXISTS `verkauf_positionen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verkauf_positionen` (
  `position_id` int NOT NULL AUTO_INCREMENT,
  `verkauf_id` int NOT NULL,
  `artikel_id` int NOT NULL,
  `artikel_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `artikel_nummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menge` int NOT NULL DEFAULT '1',
  `einzelpreis_cent` int NOT NULL,
  `mwst_prozent` decimal(5,2) NOT NULL,
  `netto_cent` int NOT NULL,
  `mwst_cent` int NOT NULL,
  `brutto_cent` int NOT NULL,
  `position_nummer` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`position_id`),
  KEY `idx_verkauf` (`verkauf_id`),
  KEY `idx_artikel` (`artikel_id`),
  KEY `idx_positionen_artikel` (`artikel_id`,`verkauf_id`),
  CONSTRAINT `verkauf_positionen_ibfk_1` FOREIGN KEY (`verkauf_id`) REFERENCES `verkaeufe` (`verkauf_id`) ON DELETE CASCADE,
  CONSTRAINT `verkauf_positionen_ibfk_2` FOREIGN KEY (`artikel_id`) REFERENCES `artikel` (`artikel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `verkauf_positionen`
--

LOCK TABLES `verkauf_positionen` WRITE;
/*!40000 ALTER TABLE `verkauf_positionen` DISABLE KEYS */;
/*!40000 ALTER TABLE `verkauf_positionen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vertraege`
--

DROP TABLE IF EXISTS `vertraege`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vertraege` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `tarif_id` int DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'aktiv',
  `monatlicher_beitrag` decimal(10,2) DEFAULT NULL COMMENT 'Tatsächlich gezahlter monatlicher Beitrag',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  `vertragsnummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Eindeutige Vertragsnummer (z.B. VTR-2024-001)',
  `kuendigungsfrist_monate` int DEFAULT '3' COMMENT 'Kündigungsfrist in Monaten vor Vertragsende',
  `mindestlaufzeit_monate` int DEFAULT '12' COMMENT 'Mindestvertragslaufzeit in Monaten',
  `automatische_verlaengerung` tinyint(1) DEFAULT '1' COMMENT 'Verlängert sich der Vertrag automatisch?',
  `verlaengerung_monate` int DEFAULT '12' COMMENT 'Um wie viele Monate verlängert sich der Vertrag?',
  `faelligkeit_tag` int DEFAULT '1' COMMENT 'Tag im Monat an dem Zahlung fällig ist',
  `rabatt_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Rabatt in Prozent',
  `rabatt_grund` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Grund für Rabatt (Familien-Rabatt, Aktion, etc.)',
  `sepa_mandat_id` int DEFAULT NULL COMMENT 'Verknüpfung mit SEPA-Mandat',
  `agb_version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Version der akzeptierten AGB',
  `agb_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Zeitpunkt der AGB-Akzeptanz',
  `datenschutz_version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Version der akzeptierten Datenschutzerklärung',
  `datenschutz_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Datenschutz-Akzeptanz',
  `widerruf_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Widerrufsbelehrung zur Kenntnis genommen',
  `hausordnung_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Hausordnung akzeptiert',
  `gesundheitserklaerung` tinyint(1) DEFAULT '0' COMMENT 'Bestätigt gesundheitliche Eignung',
  `gesundheitserklaerung_datum` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Gesundheitserklärung',
  `haftungsausschluss_akzeptiert` tinyint(1) DEFAULT '0' COMMENT 'Haftungsausschluss akzeptiert',
  `haftungsausschluss_datum` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Haftungsausschluss-Akzeptanz',
  `foto_einverstaendnis` tinyint(1) DEFAULT '0' COMMENT 'Einwilligung für Foto/Video-Aufnahmen',
  `foto_einverstaendnis_datum` datetime DEFAULT NULL COMMENT 'Zeitpunkt der Foto-Einwilligung',
  `unterschrift_datum` datetime DEFAULT NULL COMMENT 'Datum der Vertragsunterzeichnung',
  `unterschrift_digital` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Base64-kodierte digitale Unterschrift',
  `unterschrift_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP-Adresse bei digitaler Unterschrift',
  `vertragstext_pdf_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pfad zum generierten Vertrags-PDF',
  `created_by` int DEFAULT NULL COMMENT 'Benutzer der den Vertrag erstellt hat',
  `updated_by` int DEFAULT NULL COMMENT 'Benutzer der den Vertrag zuletzt bearbeitet hat',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Zeitpunkt der letzten Änderung',
  `vertragsbeginn` date DEFAULT NULL COMMENT 'Datum des Vertragsbeginns',
  `vertragsende` date DEFAULT NULL COMMENT 'Geplantes Vertragsende (vor automatischer Verlängerung)',
  `billing_cycle` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Zahlungsintervall: monatlich, vierteljährlich, halbjährlich, jährlich',
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'direct_debit' COMMENT 'Zahlungsmethode: direct_debit (SEPA), transfer (Überweisung), bar, etc.',
  `monatsbeitrag` decimal(10,2) DEFAULT NULL COMMENT 'Monatlicher Beitrag (nach Rabatten)',
  `kuendigung_eingegangen` date DEFAULT NULL COMMENT 'Datum an dem die Kündigung eingegangen ist',
  `kuendigungsgrund` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Grund für die Kündigung',
  `kuendigungsdatum` date DEFAULT NULL COMMENT 'Kündigungsdatum',
  `ruhepause_von` date DEFAULT NULL COMMENT 'Startdatum der Ruhepause',
  `ruhepause_bis` date DEFAULT NULL COMMENT 'Enddatum der Ruhepause',
  `ruhepause_dauer_monate` int DEFAULT NULL COMMENT 'Dauer der Ruhepause in Monaten',
  `magicline_contract_id` bigint DEFAULT NULL COMMENT 'MagicLine Vertrags-ID',
  `magicline_rate_term` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MagicLine Vertragslaufzeit (z.B. 12M)',
  `magicline_payment_run_group` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MagicLine Zahlungslauf-Gruppe',
  `aufnahmegebuehr_cents` int DEFAULT NULL COMMENT 'AufnahmegebÃ¼hr in Cents (z.B. 4999 = 49,99 EUR)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `vertragsnummer` (`vertragsnummer`),
  KEY `idx_vertraege_dojo_id` (`dojo_id`),
  KEY `idx_magicline_contract_id` (`magicline_contract_id`)
) ENGINE=InnoDB AUTO_INCREMENT=165 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertraege`
--

LOCK TABLES `vertraege` WRITE;
/*!40000 ALTER TABLE `vertraege` DISABLE KEYS */;
INSERT INTO `vertraege` VALUES (32,62,28,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-10-01','2025-05-01','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210197660,'12M',NULL,NULL),(33,63,28,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-12-01','2026-11-30','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210210360,'12M',NULL,NULL),(34,64,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-12-01','2026-11-30','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210213650,'12M',NULL,NULL),(35,65,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-12-01','2026-11-30','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210214741,'12M',NULL,NULL),(36,66,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-12-15','2026-12-14','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210224311,'12M',NULL,NULL),(37,67,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-12-15','2026-12-14','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210224143,'12M',NULL,NULL),(38,68,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-01-27','2027-01-26','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210243121,'12M',NULL,NULL),(39,69,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-02-01','2027-01-31','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210249701,'12M',NULL,NULL),(40,70,28,'aktiv',NULL,3,NULL,3,6,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-03-12','2026-03-11','monthly','direct_debit',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210279800,'6M',NULL,NULL),(41,71,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-03-06','2026-03-05','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210279802,'12M',NULL,NULL),(42,72,28,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-02-24','2026-02-23','monthly','direct_debit',44.99,NULL,NULL,NULL,NULL,NULL,NULL,1210279571,'3M',NULL,NULL),(43,73,28,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-02-01','2026-01-31','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210279421,'12M',NULL,NULL),(44,74,28,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-05-02','2026-02-01','monthly','direct_debit',44.99,NULL,NULL,NULL,NULL,NULL,NULL,1210345573,'3M',NULL,NULL),(45,75,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-04-24','2026-04-23','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210345421,'12M',NULL,NULL),(46,76,28,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-04-05','2026-04-04','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210346142,'12M',NULL,NULL),(47,77,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-07-16','2026-07-15','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210424791,'12M',NULL,NULL),(48,78,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-08-01','2026-07-31','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210425133,'12M',NULL,NULL),(49,79,29,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-11-30','2026-11-29','monthly','direct_debit',49.00,NULL,NULL,NULL,NULL,NULL,NULL,1210444101,'12M','Lastschriften Dojo 1.d.M.',NULL),(50,80,29,'aktiv',NULL,3,NULL,3,6,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-12-01','2026-05-31','monthly','direct_debit',65.00,NULL,NULL,NULL,NULL,NULL,NULL,1210444351,'6M','Lastschriften Dojo 1.d.M.',NULL),(51,81,30,'aktiv',NULL,2,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-12 12:31:37','2025-12-01','2026-11-30','monthly','direct_debit',69.00,NULL,NULL,NULL,NULL,NULL,NULL,1210445152,'12M',NULL,NULL),(52,82,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2023-12-11','2026-12-10','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210010860,'12M',NULL,NULL),(53,83,29,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-11-26','2026-11-25','monthly','direct_debit',49.00,NULL,NULL,NULL,NULL,NULL,NULL,1210444873,'12M','Lastschriften Dojo 1.d.M.',NULL),(54,84,29,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2025-11-26','2026-11-25','monthly','direct_debit',49.00,NULL,NULL,NULL,NULL,NULL,NULL,1210444104,'12M','Lastschriften Dojo 1.d.M.',NULL),(55,85,31,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-01-27','2026-01-26','monthly','direct_debit',64.99,NULL,NULL,NULL,NULL,NULL,NULL,1210066332,'3M','Lastschriften Dojo 1.d.M.',NULL),(56,86,31,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-01-28','2026-01-27','monthly','direct_debit',64.99,NULL,NULL,NULL,NULL,NULL,NULL,1210066371,'3M','Lastschriften Dojo 1.d.M.',NULL),(57,87,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-05-16','2026-05-15','monthly','direct_debit',54.99,NULL,NULL,NULL,NULL,NULL,NULL,1210082552,'12M','Lastschriften Dojo 1.d.M.',NULL),(58,88,28,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-05-16','2026-05-15','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210083211,'12M',NULL,NULL),(59,89,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-04-01','2026-03-31','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210082711,'12M',NULL,NULL),(60,90,28,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-05-16','2026-05-15','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210083411,'12M',NULL,NULL),(61,91,31,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 09:47:25','2024-07-11','2026-07-10','monthly','direct_debit',54.99,NULL,NULL,NULL,NULL,NULL,NULL,1210116920,'12M','Lastschriften Dojo 1.d.M.',NULL),(62,92,32,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-03-13','2025-03-12','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210504510,'12M','Lastschriften',NULL),(63,93,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-03-01','2027-02-28','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210509240,'12M','Lastschriften',NULL),(64,94,32,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-03-25','2024-09-24','monthly','direct_debit',44.99,NULL,NULL,NULL,NULL,NULL,NULL,1210513750,'3M','Lastschriften',NULL),(65,95,32,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-04-01','2024-09-30','monthly','direct_debit',44.99,NULL,NULL,NULL,NULL,NULL,NULL,1210525400,'3M','Lastschriften',NULL),(66,96,32,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-04-23','2026-01-22','monthly','direct_debit',44.99,NULL,NULL,NULL,NULL,NULL,NULL,1210537110,'3M','Lastschriften',NULL),(67,97,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-06-10','2026-06-09','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210594411,'12M','Lastschriften',NULL),(68,98,33,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-07-01','2026-06-30','monthly','direct_debit',54.99,NULL,NULL,NULL,NULL,NULL,NULL,1210594791,'12M','Lastschriften',NULL),(69,99,34,'aktiv',NULL,3,NULL,1,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-11-01','2026-10-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210689101,'12M',NULL,NULL),(70,100,34,'aktiv',NULL,3,NULL,1,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2025-03-15','2026-03-14','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210784172,'12M',NULL,NULL),(71,101,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-01-21','2023-01-20','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021680,'3M',NULL,NULL),(72,102,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2022-03-31','monthly','bank_transfer',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021880,'3M',NULL,NULL),(73,103,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-10-12','2025-12-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021681,'12M',NULL,NULL),(74,104,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-10-24','2023-11-01','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210020672,'12M',NULL,NULL),(75,105,35,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-10-24','2023-11-01','monthly','direct_debit',24.99,NULL,NULL,NULL,NULL,NULL,NULL,1210022400,'12M',NULL,NULL),(76,106,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-11-29','2022-12-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210020673,'12M',NULL,NULL),(77,107,35,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-11-29','2024-03-28','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210022720,'12M',NULL,NULL),(78,108,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-09-20','2023-09-19','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210020851,'12M',NULL,NULL),(79,109,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-09-08','2026-09-07','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021881,'12M',NULL,NULL),(80,110,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-01-20','2022-10-19','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210003610,'3M',NULL,NULL),(81,111,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-02-01','2027-01-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210023110,'12M',NULL,NULL),(82,112,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-09-13','2026-09-12','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210023400,'12M',NULL,NULL),(83,113,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-12-01','2026-11-30','monthly','bank_transfer',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021181,'12M',NULL,NULL),(84,115,31,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-09-28','2025-09-27','monthly','bank_transfer',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210020853,'12M',NULL,NULL),(85,116,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-09-18','2026-09-17','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021402,'12M',NULL,NULL),(86,118,35,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-09-13','2026-09-12','monthly','direct_debit',24.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021403,'12M',NULL,NULL),(87,119,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-09-15','2026-09-14','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021682,'12M',NULL,NULL),(88,120,34,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-10-21','2026-01-20','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210023891,'3M',NULL,NULL),(89,121,36,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2025-02-28','monthly','direct_debit',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210028751,'3M',NULL,NULL),(90,121,35,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2025-02-28','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210028750,'3M',NULL,NULL),(91,122,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-02-01','2025-01-31','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210025630,'3M',NULL,NULL),(92,123,34,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-02-01','2026-01-31','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210026660,'3M',NULL,NULL),(93,124,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-02-01','2024-07-10','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210026910,'12M',NULL,NULL),(94,125,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-02-01','2027-01-31','monthly','cash',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210026661,'12M',NULL,NULL),(95,126,31,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2025-05-31','monthly','direct_debit',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210028620,'12M',NULL,NULL),(96,127,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2025-02-28','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210029740,'12M',NULL,NULL),(97,128,35,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2025-02-28','monthly','direct_debit',24.99,NULL,NULL,NULL,NULL,NULL,NULL,1210030030,'12M',NULL,NULL),(98,129,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2027-02-28','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210030270,'12M',NULL,NULL),(99,130,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2027-02-28','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210030440,'12M',NULL,NULL),(100,131,37,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-09-01','2024-02-07','monthly','direct_debit',86.87,NULL,NULL,NULL,NULL,NULL,NULL,1210098710,'12M','Lastschriften',NULL),(101,132,38,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-02-08','2024-02-07','monthly','direct_debit',0.00,NULL,NULL,NULL,NULL,NULL,NULL,1210031620,'12M',NULL,NULL),(102,133,35,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-02-08','2024-02-07','monthly','direct_debit',0.00,NULL,NULL,NULL,NULL,NULL,NULL,1210031850,'12M',NULL,NULL),(103,134,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-03-01','2027-02-28','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210033950,'12M',NULL,NULL),(104,135,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-04-01','2026-03-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210037540,'12M',NULL,NULL),(105,136,35,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-04-01','2026-03-31','monthly','direct_debit',24.99,NULL,NULL,NULL,NULL,NULL,NULL,1210037541,'12M',NULL,NULL),(106,137,34,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-04-11','2026-01-10','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210043790,'3M',NULL,NULL),(107,138,39,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-01-20','2023-03-14','monthly','bank_transfer',0.00,NULL,NULL,NULL,NULL,NULL,NULL,1210020190,'12M',NULL,NULL),(108,139,34,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-04-18','2026-01-17','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210043791,'3M',NULL,NULL),(109,139,36,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-04-18','2026-01-17','monthly','direct_debit',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210043792,'3M',NULL,NULL),(110,140,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-09-01','2026-08-31','monthly','direct_debit',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210111080,'12M',NULL,NULL),(111,141,31,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-08-01','2024-07-31','monthly','direct_debit',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210111300,'12M',NULL,NULL),(112,142,31,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-09-15','2025-05-13','monthly','direct_debit',54.99,NULL,NULL,NULL,NULL,NULL,NULL,1210114670,'3M',NULL,NULL),(113,143,31,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-09-15','2026-03-14','monthly','direct_debit',54.99,NULL,NULL,NULL,NULL,NULL,NULL,1210114671,'3M',NULL,NULL),(114,144,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-09-19','2024-06-18','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210114990,'3M',NULL,NULL),(115,145,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-09-23','2023-06-22','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210120340,'3M',NULL,NULL),(116,146,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-08-10','2026-11-09','monthly','direct_debit',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210121000,'12M',NULL,NULL),(117,147,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-08-17','2024-08-16','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210120341,'12M',NULL,NULL),(118,148,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-06-01','2026-06-30','monthly','direct_debit',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210125270,'12M',NULL,NULL),(119,149,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-07-03','2026-07-02','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210125520,'12M',NULL,NULL),(120,150,35,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-10-05','2027-01-04','monthly','cash',24.99,NULL,NULL,NULL,NULL,NULL,NULL,1210126600,'12M',NULL,NULL),(121,150,36,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-10-05','2027-01-04','monthly','cash',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210126601,'12M',NULL,NULL),(122,151,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-10-09','2023-10-08','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210143692,'12M',NULL,NULL),(123,151,36,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-10-09','2023-10-08','monthly','direct_debit',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210143693,'12M',NULL,NULL),(124,152,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-10-24','2027-01-23','monthly','cash',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210143694,'12M',NULL,NULL),(125,153,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-10-24','2026-10-23','monthly','direct_debit',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210143696,'12M',NULL,NULL),(126,154,34,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-11-08','2026-02-07','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210150720,'3M',NULL,NULL),(127,155,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-11-01','2026-10-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210150434,'12M',NULL,NULL),(128,156,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-11-01','2023-09-01','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210156411,'12M',NULL,NULL),(129,157,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-01-21','2025-01-20','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210020850,'12M',NULL,NULL),(130,158,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-11-15','2023-09-01','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210158910,'12M',NULL,NULL),(131,159,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-11-27','2024-11-26','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210164431,'3M',NULL,NULL),(132,160,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-12-15','2023-10-30','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210178710,'12M',NULL,NULL),(133,161,31,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-01-25','2026-03-24','monthly','cash',54.99,NULL,NULL,NULL,NULL,NULL,NULL,1210202690,'3M',NULL,NULL),(134,162,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-04-07','2025-07-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210251060,'329T',NULL,NULL),(135,162,31,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-03-01','2023-04-06','monthly','direct_debit',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210225021,'12M',NULL,NULL),(136,163,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-01-15','2025-01-14','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210229631,'12M',NULL,NULL),(137,164,34,'aktiv',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-02-06','2026-02-05','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210229633,'3M',NULL,NULL),(138,165,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-03-13','2026-03-12','monthly','cash',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210231930,'12M',NULL,NULL),(139,166,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-12-19','2023-03-18','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210231461,'3M',NULL,NULL),(140,167,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-10-11','2025-10-10','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210020671,'12M',NULL,NULL),(141,168,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-06-04','2024-03-03','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210314950,'3M',NULL,NULL),(142,169,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-05-01','2026-04-30','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210326022,'12M',NULL,NULL),(143,170,34,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-09-01','2026-08-31','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210380552,'12M',NULL,NULL),(144,171,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-10-25','2024-07-24','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210380131,'3M',NULL,NULL),(145,172,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-11-07','2026-11-06','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210393950,'12M','Lastschriften',NULL),(146,173,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-11-12','2026-11-11','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210397910,'12M','Lastschriften',NULL),(147,174,32,'gekuendigt',NULL,3,NULL,3,6,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-11-12','2025-02-04','monthly','direct_debit',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210397911,'6M','Lastschriften',NULL),(148,174,32,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2025-02-05','2027-02-04','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210742490,'12M','Lastschriften',NULL),(149,175,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-11-13','2026-11-12','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210398910,'12M','Lastschriften',NULL),(150,176,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-11-01','2025-04-30','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210406740,'3M',NULL,NULL),(151,177,34,'gekuendigt',NULL,3,NULL,1,3,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-10-01','2024-03-31','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210407500,'3M',NULL,NULL),(152,178,34,'gekuendigt',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2022-01-21','2025-01-20','monthly','direct_debit',29.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021180,'12M',NULL,NULL),(153,179,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-11-28','2026-12-28','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210413070,'12M','Lastschriften',NULL),(154,180,32,'gekuendigt',NULL,3,NULL,3,6,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-12-01','2025-03-31','monthly','cash',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210417690,'6M','Lastschriften',NULL),(155,180,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2025-04-01','2026-03-31','monthly','cash',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210784350,'12M','Lastschriften',NULL),(156,181,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-12-06','2026-12-05','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210423310,'12M','Lastschriften',NULL),(157,182,40,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2023-12-06','2026-12-05','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210423311,'12M','Lastschriften',NULL),(158,183,32,'gekuendigt',NULL,3,NULL,3,6,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-01-08','2025-07-07','monthly','direct_debit',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210449720,'6M','Lastschriften',NULL),(159,184,32,'gekuendigt',NULL,3,NULL,3,6,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-02-07','2026-02-06','monthly','direct_debit',39.99,NULL,NULL,NULL,NULL,NULL,NULL,1210474480,'6M','Lastschriften',NULL),(160,185,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-02-07','2027-02-06','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210474481,'12M','Lastschriften',NULL),(161,186,33,'gekuendigt',NULL,3,NULL,3,6,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-02-18','2025-08-17','monthly','direct_debit',59.99,NULL,NULL,NULL,NULL,NULL,NULL,1210483060,'6M','Lastschriften',NULL),(162,187,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-02-20','2027-02-19','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210485350,'12M','Lastschriften',NULL),(163,188,32,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2024-02-28','2027-02-27','monthly','direct_debit',34.99,NULL,NULL,NULL,NULL,NULL,NULL,1210493270,'12M','Lastschriften',NULL),(164,189,31,'aktiv',NULL,3,NULL,3,12,1,12,1,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-07 21:37:09','2021-10-07','2026-10-06','monthly','cash',49.99,NULL,NULL,NULL,NULL,NULL,NULL,1210021400,'12M',NULL,NULL);
/*!40000 ALTER TABLE `vertraege` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vertraege_geloescht`
--

DROP TABLE IF EXISTS `vertraege_geloescht`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vertraege_geloescht` (
  `id` int NOT NULL,
  `mitglied_id` int NOT NULL,
  `dojo_id` int NOT NULL,
  `tarif_id` int DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vertragsbeginn` date DEFAULT NULL,
  `vertragsende` date DEFAULT NULL,
  `billing_cycle` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monatsbeitrag` decimal(10,2) DEFAULT NULL,
  `kuendigung_eingegangen` date DEFAULT NULL,
  `kuendigungsgrund` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kuendigungsdatum` date DEFAULT NULL,
  `ruhepause_von` date DEFAULT NULL,
  `ruhepause_bis` date DEFAULT NULL,
  `ruhepause_dauer_monate` int DEFAULT NULL,
  `agb_akzeptiert_am` datetime DEFAULT NULL,
  `datenschutz_akzeptiert_am` datetime DEFAULT NULL,
  `hausordnung_akzeptiert_am` datetime DEFAULT NULL,
  `unterschrift_datum` datetime DEFAULT NULL,
  `unterschrift_ip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `geloescht_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `geloescht_von` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geloescht_grund` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_mitglied_id` (`mitglied_id`),
  KEY `idx_dojo_id` (`dojo_id`),
  KEY `idx_geloescht_am` (`geloescht_am`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Archiv für gelöschte Verträge';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertraege_geloescht`
--

LOCK TABLES `vertraege_geloescht` WRITE;
/*!40000 ALTER TABLE `vertraege_geloescht` DISABLE KEYS */;
INSERT INTO `vertraege_geloescht` VALUES (1,1,2,21,'aktiv',NULL,NULL,NULL,'direct_debit',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-11-28 09:53:22','2025-11-28 09:53:22','2025-11-28 09:53:22','2025-11-28 09:53:22',NULL,NULL,'2025-11-28 08:53:22','2025-11-29 09:47:05','admin','eigener Sohn');
/*!40000 ALTER TABLE `vertraege_geloescht` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vertragsdokumente`
--

DROP TABLE IF EXISTS `vertragsdokumente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vertragsdokumente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int NOT NULL COMMENT 'Zugehöriges Dojo (Tax Compliance!)',
  `dokumenttyp` enum('agb','datenschutz','widerruf','hausordnung','dojokun','haftung','sonstiges','kuendigung') COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Versions-Nummer (z.B. 1.0, 2.1)',
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Titel des Dokuments',
  `inhalt` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Vollständiger Text des Dokuments (HTML/Markdown)',
  `pdf_pfad` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pfad zum PDF (falls vorhanden)',
  `gueltig_ab` date NOT NULL COMMENT 'Ab wann ist dieses Dokument gültig',
  `gueltig_bis` date DEFAULT NULL COMMENT 'Bis wann gültig (NULL = unbegrenzt)',
  `aktiv` tinyint(1) DEFAULT '1' COMMENT 'Ist diese Version aktuell aktiv?',
  `erstellt_von` int DEFAULT NULL COMMENT 'Benutzer der das Dokument erstellt hat',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Erstellungszeitpunkt',
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_dojo_dokumenttyp_version` (`dojo_id`,`dokumenttyp`,`version`),
  KEY `idx_dojo_dokumenttyp` (`dojo_id`,`dokumenttyp`),
  KEY `idx_aktiv` (`aktiv`),
  CONSTRAINT `vertragsdokumente_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Rechtliche Dokumente (AGB, Datenschutz, etc.) pro Dojo mit Versionierung';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertragsdokumente`
--

LOCK TABLES `vertragsdokumente` WRITE;
/*!40000 ALTER TABLE `vertragsdokumente` DISABLE KEYS */;
INSERT INTO `vertragsdokumente` VALUES (1,2,'agb','1.0','AGB (Allgemeine Geschäftsbedingungen)','Allgemeine Geschäftsbedingungen (AGB)\n\nder Kampfsportschule Schreiner\nOhmstraße 14, 84137 Vilsbiburg\n(im Folgenden „Schule“, „Anbieter“)\n\nStand: 31.10.2025\n\n1. Geltung, Vertragsparteien, Änderungen\n\n1.1. Diese AGB gelten für alle Verträge, Leistungen, Kurse und Mitgliedschaften, die zwischen der Kampfsportschule Schreiner (im Folgenden „Schule“) und den Teilnehmenden bzw. Mitgliedern (im Folgenden „Mitglied“, „Teilnehmer“, „Kunde“) geschlossen werden.\n\n1.2. Abweichende Bedingungen des Kunden werden ausdrücklich zurückgewiesen, es sei denn, die Schule hat ihnen schriftlich ausdrücklich zugestimmt.\n\n1.3. Einzelverträge und schriftliche Vereinbarungen haben Vorrang vor diesen AGB.\n\n1.4. Änderungen oder Ergänzungen dieser AGB bedürfen zur Wirksamkeit der Schriftform, sofern nicht ausdrücklich etwas anderes geregelt ist.\n\n1.5. Die Schule behält sich vor, einzelne Regelungen dieser AGB mit Wirkung für die Zukunft zu ändern. Änderungen werden dem Mitglied mindestens vier Wochen vor Inkrafttreten in Textform (z. B. E‑Mail, Aushang, Post) bekannt gegeben. Widerspricht das Mitglied der Änderung nicht schriftlich bis zum Inkrafttreten, gelten die Änderungen als angenommen. Auf die Bedeutung der Widerspruchsfrist wird die Schule den Teilnehmenden bei Bekanntgabe besonders hinweisen.\n\n2. Vertragsabschluss, Teilnahmevoraussetzungen\n\n2.1. Der Vertrag über die Teilnahme an Kursen, das Training oder eine Mitgliedschaft kommt zustande durch Unterzeichnung eines schriftlichen Vertrags oder eines Anmeldeformulars oder – soweit angeboten – durch Elektronische Anmeldung mit Bestätigung durch die Schule.\n\n2.2. Minderjährige (unter 18 Jahren) dürfen einen Vertrag nur mit Einwilligung der gesetzlichen Vertreter schließen. Diese müssen durch Unterschrift zustimmen.\n\n2.3. Vor Beginn der Teilnahme ist ein Gesundheitsfragebogen/Erklärung zur Sporttauglichkeit durch den Teilnehmenden oder – bei Minderjährigen – durch die gesetzlichen Vertreter auszufüllen. Der Teilnehmende bestätigt damit, dass keine medizinischen Einwände gegen die Teilnahme bestehen, oder er legt ein ärztliches Attest vor, wenn gesundheitliche Risiken bestehen.\n\n2.4. Der Anbieter kann die Teilnahme verweigern, wenn der Gesundheitszustand des Teilnehmenden Bedenken aufwirft, insbesondere wenn eine Gefährdung für sich oder andere bestehen könnte.\n\n3. Leistungsumfang und Nutzung\n\n3.1. Gegenstand der Leistungen sind Trainings-, Kurs- und Unterrichtsangebote im Bereich Kampfsport, Selbstverteidigung, Fitness-Training etc., sowie gegebenenfalls Zusatzleistungen (z. B. Personal Training, Seminare, Prüfungen).\n\n3.2. Der konkrete Leistungsumfang ergibt sich aus dem Vertrag bzw. der Leistungsbeschreibung im Angebot der Schule.\n\n3.3. Die Nutzung der Räumlichkeiten, der Ausstattung und Hilfsmittel erfolgt nur zu dem im Vertrag festgelegten Umfang und nach Maßgabe der Hausordnung.\n\n3.4. Eine Übertragung der Mitgliedschaft oder der Teilnahmeberechtigung auf Dritte ist ausgeschlossen, sofern nichts anderes ausdrücklich vereinbart ist.\n\n4. Pflichten der Mitglieder / Teilnehmer\n\n4.1. Die Mitglieder verpflichten sich insbesondere:\n\ndie Anweisungen der Trainer, Übungsleiter oder des Personals zu befolgen;\n\nsich an die Hausordnung sowie Sicherheits- und Hygienevorschriften zu halten;\n\nkeine Handlungen vorzunehmen, die Gefahr für Leib, Leben oder Eigentum anderer darstellen;\n\nvor oder während der Teilnahme auftretende Unwohlsein, gesundheitliche Beschwerden oder Verletzungen unverzüglich dem Trainer oder der Schule anzuzeigen;\n\neigenes Trainingsmaterial (z. B. geeignete Kleidung, Schutzausrüstung, Getränke) mitzubringen, sofern nicht durch die Schule gestellt;\n\nSauberkeit, Ordnung und Rücksicht auf andere Teilnehmende zu wahren.\n\n4.2. Bei groben oder wiederholten Pflichtverletzungen kann die Schule den Vertrag außerordentlich kündigen (siehe Ziffer 8).\n\n4.3. Das Mitglied ist verpflichtet, Änderungen seiner Kontakt- oder Bankdaten unverzüglich mitzuteilen.\n\n5. Beiträge, Preise, Zahlung\n\n5.1. Die Höhe der Beiträge, Kursgebühren und Zusatzkosten ergibt sich aus der aktuellen Preisliste bzw. dem Vertrag.\n\n5.2. Die Beiträge sind regelmäßig im Voraus – meist monatlich, vierteljährlich oder jährlich – zu entrichten. Der genaue Fälligkeitstermin ergibt sich aus dem Vertrag.\n\n5.3. Bei Zahlungsverzug gelten folgende Regelungen:\n\nNach Mahnung wird eine Mahngebühr (fester Betrag oder Prozentsatz) erhoben;\n\nBei Nichtzahlung kann die Schule den Zutritt verweigern, bis der Rückstand beglichen ist;\n\nNach einer bestimmten Frist (z. B. 2–3 Monate) kann die Schule den Vertrag kündigen und die Rückstände und den restlichen ausstehenden Betrag bis zur Beendigung des Vertrages einfordern.\n\n5.4. Bei Verträgen über einen bestimmten Zeitraum (z. B. Jahresvertrag) wird bei vorzeitiger Beendigung durch das Mitglied keine anteilige Rückerstattung geleistet, sofern nicht ausdrücklich anders vereinbart oder gesetzlich vorgeschrieben.\n\n5.5. Sonderleistungen oder Zusatzangebote (z. B. Privatstunden, Prüfungsgebühren) werden gesondert berechnet und sind ebenfalls fristgerecht zu zahlen.\n\n5.6. Die Schule behält sich vor, Beiträge und Gebühren anzupassen (z. B. wegen gestiegener Kosten). Eine Erhöhung wird dem Mitglied mindestens vier Wochen vorher in Textform mitgeteilt. Widerspricht das Mitglied nicht fristgerecht schriftlich, gilt die Erhöhung als genehmigt. Ein Sonderkündigungsrecht wird nicht gewährleistet.\n\n6. Vertragsdauer und Kündigung\n\n6.1. Vertragsdauer und Kündigungsfristen ergeben sich aus dem jeweiligen Vertrag (z. B. Monat auf Monatsbasis, Mindestvertragsdauer, Laufzeit, Verlängerung).\n\n6.2. Die Kündigung bedarf der Schriftform (Brief, E-Mail, – sofern im Vertrag zugelassen – elektronisch), sofern nicht anders vereinbart.\n\n6.3. Bei Verträgen mit Mindestlaufzeit ist eine ordentliche Kündigung frühestens zum Ende der Mindestlaufzeit möglich. Danach gilt meist eine Kündigungsfrist (z. B. 1–3 Monate).\n\n6.4. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor:\n\nwenn eine Partei ihre vertraglichen Pflichten schwerwiegend verletzt;\n\nbei erheblicher Gesundheitsgefährdung des Mitglieds;\n\nbei Insolvenz oder Einstellung des Geschäftsbetriebs der Schule.\n\n7. Unterbrechung / Ruhen des Vertrages\n\n7.1. In bestimmten Ausnahmefällen (z. B. längere Krankheit, Schwangerschaft, Auslandsaufenthalt) kann der Vertrag auf schriftlichen Antrag und Nachweis befristet ruhen. Die Mindestdauer, Höchstdauer und Bedingungen für einen solchen „Freeze“ sind im Vertrag oder der Preisliste festzulegen.\n\n7.2. Für Ruhtage ist in der Regel ein Entgelt bzw. Verwaltungskosten oder ein reduzierter Beitrag zu erheben.\n\n7.3. Während der Ruhezeiten besteht kein Anspruch auf Nutzung der Leistungen, es sei denn, es wird ausdrücklich etwas Anderes vereinbart.\n\n8. Haftung, Versicherung, Ausschluss\n\n8.1. Die Schule haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung oder auf Vorsatz/Grobe Fahrlässigkeit der Schule oder ihrer Erfüllungsgehilfen beruhen.\n\n8.2. Für sonstige Schäden haftet die Schule nur bei Vorsatz oder grober Fahrlässigkeit, es sei denn, eine Pflichtverletzung betrifft eine wesentliche Vertragspflicht (Kardinalpflicht). In diesem Fall ist die Haftung auf den typischerweise vorhersehbaren Schaden begrenzt.\n\n8.3. Eine Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit gesetzlich zulässig.\n\n8.4. Insbesondere haftet die Schule nicht für:\n\nVerletzungen oder Schäden, die durch Zuwiderhandlung gegen Anweisungen, Regeln oder Sicherheitsvorgaben oder durch den Körperkontakt im Kampftraining entstehen;\n\nSchäden, die durch eigenes fahrlässiges Verhalten des Mitglieds verursacht werden;\n\nSchäden an mitgebrachten Gegenständen oder Wertgegenständen (z. B. Kleidung, Schmuck, elektronische Geräte), sofern nicht grobe Fahrlässigkeit oder Vorsatz vorliegt.\n\n8.5. Der Teilnehmende ist verpflichtet, eigene Unfall- und Haftpflichtversicherung zu haben, soweit möglich, und ggf. Schädenmeldungspflichten zu erfüllen.\n\n9. Aussetzung und Ersatztraining\n\n9.1. Die Schule kann aufgrund von Betriebsstörungen, behördlichen Anordnungen, außergewöhnlichen Ereignissen (z. B. Unwetter, Pandemien), Krankheit von Trainern oder aus anderen wichtigen Gründen den Trainingsbetrieb ganz oder teilweise unterbrechen.\n\n9.2. In solchen Fällen kann die Schule nach Möglichkeit Ersatztermine oder alternative Angebote anbieten oder eine anteilige Gutschrift bzw. Beitragsminderung gewähren.\n\n9.3. Der Anspruch auf Ersatzleistung erlischt, wenn das Mitglied die Ersatzangebote nicht innerhalb einer angemessenen Frist in Anspruch nimmt, ohne ein berechtigtes Hindernis geltend zu machen.\n\n10. Widerrufsrecht für Verbraucher\n\n10.1. Sofern ein Vertrag online oder außerhalb von Geschäftsräumen mit einem Verbraucher geschlossen wird, steht dem Verbraucher ein gesetzliches Widerrufsrecht zu (vgl. §§ 312g, 355 BGB).\n\n10.2. Die Widerrufsbelehrung und die Bedingungen zum Widerruf sind im Vertrag bzw. in der Auftragsbestätigung getrennt darzustellen.\n\n10.3. Das Widerrufsrecht entfällt vollständig bei Verträgen zur Erbringung von Dienstleistungen (z. B. Trainingsleistungen, Mitgliedschaften, Kurse), wenn der Vertrag für eine bestimmte Zeit abgeschlossen ist und die Ausführung der Dienstleistung mit Zustimmung des Verbrauchers beginnt und der Verbraucher seine Kenntnis bestätigt, dass er mit Beginn der Vertragserfüllung sein Widerrufsrecht verliert.\n\n11. Datenschutz\n\n11.1. Die Schule erhebt, verarbeitet und nutzt personenbezogene Daten der Mitglieder nur, soweit dies zur Durchführung des Vertrags nötig ist, gesetzlich erlaubt oder vom Mitglied ausdrücklich genehmigt ist.\n\n11.2. Nähere Einzelheiten zur Datenverarbeitung, Zweckbindung, Speicherung und Rechte der Betroffenen ergeben sich aus der gesonderten Datenschutzinformation / Datenschutzrichtlinie der Schule.\n\n12. Schlussbestimmungen, Salvatorische Klausel, Gerichtsstand, anwendbares Recht\n\n12.1. Sollten einzelne Bestimmungen dieser AGB unwirksam oder undurchführbar sein oder werden, bleibt die Gültigkeit der übrigen Bestimmungen unberührt. Die Parteien verpflichten sich, die unwirksame Regelung durch eine solche wirksame zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen möglichst nahekommt.\n\n12.2. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.\n\n12.3. Soweit gesetzlich zulässig und der Teilnehmende Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist, ist ausschließlicher Gerichtsstand der Sitz der Schule (Vilsbiburg). Andernfalls gelten die gesetzlichen Gerichtsstände.\n\n12.4. Änderungen oder Ergänzungen des Vertrags, einschließlich dieser Klausel, bedürfen der Schriftform.',NULL,'2025-12-18',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:57:18'),(2,2,'datenschutz','1.0','Datenschutzerklärung','1. Verantwortlicher\n\nTiger & Dragon Association – International\nInhaber / Verantwortlicher: Sascha Schreiner\nAnschrift: Geigelsteinstr. 14, 84137 Vilsbiburg, Deutschland\nTelefon: +49 (0)1575 2461776\nE-Mail: info@tda-intl.com\n\nWebseite: www.tda-intl.com\n\n(im Folgenden „wir“, „uns“ oder „TDA Int’l“)\n\n2. Geltungsbereich\n\nDiese Datenschutzerklärung informiert dich darüber, welche personenbezogenen Daten wir erheben, wenn du\n\nunsere Webseite www.tda-intl.com\n besuchst,\n\ndich oder deine Schule/deinen Verein zu unseren Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events oder anderen Events anmeldest,\n\nmit uns per E-Mail, Telefon, Kontaktformular oder auf andere Weise in Kontakt trittst,\n\nMitglied im Verband wirst oder als Partner/Instructor mit uns zusammenarbeitest.\n\nSie gilt insbesondere im Rahmen der Datenschutz-Grundverordnung (DSGVO) und des Bundesdatenschutzgesetzes (BDSG).\n\n3. Begriffe\n\n„Personenbezogene Daten“ sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen (z. B. Name, Adresse, E-Mail, IP-Adresse).\n\n„Verarbeitung“ ist jeder Vorgang im Zusammenhang mit personenbezogenen Daten (z. B. Erheben, Speichern, Übermitteln, Löschen).\n\n4. Rechtsgrundlagen der Verarbeitung\n\nWir verarbeiten personenbezogene Daten auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO – Einwilligung\n\nArt. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung oder vorvertragliche Maßnahmen (z. B. Turnieranmeldung, Mitgliedsantrag)\n\nArt. 6 Abs. 1 lit. c DSGVO – rechtliche Verpflichtung (z. B. Aufbewahrungspflichten)\n\nArt. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse\n(z. B. sichere Bereitstellung der Webseite, Organisation von Veranstaltungen, Außendarstellung, Verbandsverwaltung)\n\n5. Bereitstellung der Webseite und Server-Logfiles\n5.1 Art der Daten\n\nBeim Besuch unserer Webseite werden durch den von dir verwendeten Browser automatisch Informationen an unseren Server übermittelt und in Server-Logfiles gespeichert. Dies sind u. a.:\n\nIP-Adresse deines Endgeräts\n\nDatum und Uhrzeit des Zugriffs\n\naufgerufene Seite/Datei\n\nReferrer-URL (zuvor besuchte Seite, falls übermittelt)\n\nverwendeter Browser und Betriebssystem\n\nggf. Name deines Access-Providers\n\nDiese Daten werden nicht mit anderen Datenquellen zusammengeführt und nicht zur Identifizierung einzelner Personen verwendet.\n\n5.2 Zweck\n\nSicherstellung eines reibungslosen Verbindungsaufbaus der Webseite\n\nGewährleistung einer komfortablen Nutzung unserer Webseite\n\nAuswertung der Systemsicherheit und -stabilität\n\ntechnische Administration\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und stabilen Betrieb der Webseite).\n\n5.3 Speicherdauer\n\nServer-Logfiles werden in der Regel für 7–30 Tage gespeichert und anschließend automatisch gelöscht, sofern keine längere Aufbewahrung zu Beweiszwecken im Einzelfall erforderlich ist (z. B. bei Sicherheitsvorfällen).\n\n6. Cookies und Einwilligungs-Management\n6.1 Cookies\n\nUnsere Webseite kann sogenannte Cookies verwenden. Das sind kleine Textdateien, die auf deinem Endgerät gespeichert werden.\n\nArten von Cookies:\n\nTechnisch notwendige Cookies\nz. B. zur Sprachauswahl, Sitzungserkennung, Warenkorb-/Formularfunktionen, Login-Bereich\n→ Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO oder § 25 Abs. 2 TTDSG\n\nOptionale Cookies (z. B. für Statistik/Analyse oder Marketing) – falls eingesetzt\n→ Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 25 Abs. 1 TTDSG (nur mit Einwilligung)\n\n6.2 Cookie-Einwilligung\n\nSofern wir ein Cookie-Banner / Consent-Tool einsetzen, kannst du dort entscheiden, welchen Kategorien von Cookies du zustimmst. Deine Auswahl kannst du jederzeit über die entsprechenden Einstellungen im Consent-Tool oder in deinem Browser ändern.\n\n7. Kontaktaufnahme (E-Mail, Telefon, Kontaktformular)\n\nWenn du uns kontaktierst, z. B. per E-Mail, Telefon oder Kontaktformular, verarbeiten wir die von dir mitgeteilten Daten:\n\nName\n\nKontaktdaten (E-Mail, Telefonnummer)\n\nBetreff und Inhalt deiner Nachricht\n\nggf. Vereins-/Dojo-Name, Land, Funktion (Instructor, Schüler, Funktionär usw.)\n\nZweck der Verarbeitung ist die Bearbeitung deines Anliegens, Rückfragen und Kommunikation.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO, sofern deine Anfrage mit der Durchführung eines Vertrages oder vorvertraglicher Maßnahmen zusammenhängt (z. B. Turnieranmeldung, Mitgliedsantrag).\n\nArt. 6 Abs. 1 lit. f DSGVO, bei allgemeinen Anfragen (berechtigtes Interesse an effektiver Kommunikation).\n\nSpeicherdauer:\nWir speichern deine Anfrage, solange es zur Bearbeitung erforderlich ist. Danach werden die Daten regelmäßig gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.\n\n8. Mitgliedschaft, Verband, Schulen & Partner\n\nWenn du Mitglied bei TDA Int’l wirst oder als Dojo/Schule/Instructor mit uns zusammenarbeitest, verarbeiten wir – je nach Rolle – insbesondere:\n\nStammdaten: Name, Adresse, Geburtsdatum, Kontaktdaten (Telefon, E-Mail)\n\nVerbandsbezogene Daten: Dojo-/Vereinsname, Stilrichtung(en), Position im Verband, Mitgliedsstatus, Funktion (Instructor, Schulleiter, Funktionär)\n\nVertrags- und Abrechnungsdaten: Bankverbindung, Zahlungsinformationen (z. B. Beitragszahlungen), ggf. Rechnungen\n\nKommunikationsdaten: Schriftwechsel im Zusammenhang mit der Mitgliedschaft/Kooperation\n\nZweck:\n\nVerwaltung von Mitgliedern, Schulen und Partnern\n\nDurchführung des Mitgliedschafts- oder Kooperationsverhältnisses\n\nOrganisation von Veranstaltungen, Ernennungen, Lizenzen, Instructor-Tätigkeiten\n\nAbrechnung und Beitragseinzug\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und ggf. Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten, z. B. steuerliche Aufbewahrung).\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Mitgliedschaft/Kooperation und darüber hinaus für gesetzliche Aufbewahrungsfristen (in der Regel 6–10 Jahre) gespeichert. Daten, die nicht mehr benötigt werden, werden gelöscht oder anonymisiert.\n\n9. Online-Anmeldung zu Turnieren, Seminaren, Hall of Fame & Events\n\nZur Anmeldung zu unseren Turnieren, Hall-of-Fame-Veranstaltungen, Seminaren, Charity-Events und weiteren Events erheben wir je nach Event folgende Daten von Teilnehmern, Trainern, Vereinen/Schulen:\n\nPersonendaten der Teilnehmer*innen:\nName, Vorname, Geburtsdatum, Geschlecht, Nationalität\n\nSportbezogene Daten:\nStilrichtung, Graduierung/Gürtel, Gewichtsklasse, Startkategorien, Wettkampfklassen, ggf. Leistungsstand\n\nKontaktdaten:\nAnschrift, E-Mail, Telefonnummer des Teilnehmers oder Vereins/Trainers\n\nVereins-/Dojo-Daten:\nName, Anschrift, Ansprechpartner, Verband, Land\n\nAbrechnungsdaten:\nTeilnahmegebühren, Zahlungsinformationen (z. B. Vermerk über Zahlungseingang – konkrete Zahlungsdaten beim Zahlungsdienstleister)\n\nZwecke der Verarbeitung:\n\nOrganisation und Durchführung der Veranstaltung\n\nErstellung von Startlisten, Pools, Kampffeldern und Zeitplänen\n\nErgebniserfassung, Ranglisten, Siegerehrungen, Urkunden\n\nKommunikation mit Teilnehmern, Vereinen und Offiziellen\n\nAbrechnung und ggf. Nachweis gegenüber Sponsoren, Partnern oder Verbänden\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung – Durchführung der Veranstaltung)\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer professionellen Organisation und sportlichen Auswertung)\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Veranstaltungsorganisation sowie für die Dokumentation von Ergebnissen (z. B. Ranglisten, Jahreswertung, Hall of Fame) gespeichert. Soweit möglich, werden Langzeitauswertungen in anonymisierter oder pseudonymisierter Form geführt. Rechts- und steuerrelevante Daten bewahren wir gemäß der gesetzlichen Fristen auf.\n\n10. Hall of Fame, Berichterstattung, Fotos & Videos\n\nIm Rahmen von Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events und sonstigen Veranstaltungen erstellen wir ggf. Fotos und Videos, u. a. für:\n\nBerichte zu Veranstaltungen auf unserer Webseite, in Social Media, in Newslettern oder Printmedien\n\nDokumentation sportlicher Leistungen und Ehrungen\n\nArchivzwecke und Hall-of-Fame-Einträge\n\nDabei können Teilnehmer, Trainer, Offizielle, Gäste und Ehrengäste erkennbar sein.\n\nRechtsgrundlagen:\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Berichterstattung, Außendarstellung, Dokumentation des Verbandslebens)\n\nsoweit erforderlich: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. bei Portraitaufnahmen, Nahaufnahmen oder bestimmten Veröffentlichungen)\n\nWenn du nicht fotografiert werden möchtest oder mit einer Veröffentlichung nicht einverstanden bist, kannst du uns das möglichst frühzeitig mitteilen (z. B. an der Anmeldung, beim Fotografen oder per E-Mail). Bereits veröffentlichte Inhalte prüfen wir im Einzelfall und entfernen sie, sofern keine überwiegenden berechtigten Interessen entgegenstehen.\n\n11. Newsletter & Informationsmails (falls eingesetzt)\n\nSofern wir einen Newsletter oder regelmäßige Informationsmails anbieten, gilt:\n\nFür den Versand benötigen wir deine E-Mail-Adresse und ggf. deinen Namen.\n\nDie Anmeldung erfolgt in der Regel über ein Double-Opt-In-Verfahren: Erst nach Bestätigung deiner E-Mail-Adresse erhältst du den Newsletter.\n\nDu kannst dich jederzeit vom Newsletter abmelden, z. B. über einen Abmeldelink in jeder E-Mail oder durch Nachricht an uns.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung)\n\nSpeicherdauer:\nWir speichern deine Daten, bis du dich vom Newsletter abmeldest oder deine Einwilligung widerrufst.\n\n12. Nutzerkonten / Login-Bereich (falls vorhanden)\n\nWenn wir einen geschützten Login-Bereich für Vereine/Instruktoren/Teilnehmer anbieten, verarbeiten wir:\n\nZugangsdaten (Benutzername, Passwort – Passwort nur in verschlüsselter Form)\n\nRegistrierungsdaten (Name, E-Mail, Verein, Rolle im System)\n\nNutzungsdaten (z. B. erfasste Teilnehmer, Meldungen, Bearbeitungen im System)\n\nZweck: Bereitstellung des geschützten Bereichs, Verwaltung von Meldungen, Administration von Turnieren und Verbandsdaten.\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzervertrag für den Login-Bereich) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherer Systemverwaltung).\n\n13. Zahlungsabwicklung (falls über Zahlungsdienstleister)\n\nSofern Teilnahmegebühren, Mitgliedsbeiträge oder andere Leistungen über Zahlungsdienstleister oder Kreditinstitute abgewickelt werden, werden die hierfür erforderlichen Daten (z. B. Name, Betrag, IBAN/BIC oder andere Zahlungsinformationen) an das jeweilige Unternehmen übermittelt.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung – Zahlungsabwicklung)\n\nArt. 6 Abs. 1 lit. c DSGVO (gesetzliche Aufbewahrungspflichten)\n\nDie detaillierte Verarbeitung erfolgt beim jeweiligen Zahlungsdienstleister. Bitte beachte ergänzend deren Datenschutzhinweise.\n\n14. Webanalyse & Tracking (falls eingesetzt)\n\nSofern wir Webanalyse-Dienste (z. B. zur statistischen Auswertung der Nutzung unserer Webseite) verwenden, geschieht dies nur auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung, falls Cookies/Tracking erforderlich) oder\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer bedarfsgerechten Gestaltung und Optimierung der Webseite), soweit dies ohne Einwilligung zulässig ist.\n\nDie konkrete Ausgestaltung (Dienstleister, Umfang der Datenverarbeitung, Speicherdauer, ggf. Drittlandtransfer) wird in einem separaten Abschnitt oder im Cookie-Banner erläutert, sobald diese Dienste eingesetzt werden.\n\n15. Empfänger der Daten / Auftragsverarbeiter\n\nWir geben personenbezogene Daten nur an Dritte weiter, soweit dies\n\nzur Vertragserfüllung notwendig ist (z. B. Dienstleister für IT, Hosting, Zahlungsabwicklung, Urkundendruck, Versand),\n\nwir dazu gesetzlich verpflichtet sind (z. B. Behörden, Finanzamt),\n\nes zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist oder\n\ndu eingewilligt hast.\n\nMit Dienstleistern, die in unserem Auftrag personenbezogene Daten verarbeiten, schließen wir Auftragsverarbeitungsverträge gemäß Art. 28 DSGVO.\n\n16. Datenübermittlung in Drittländer\n\nDa wir ein internationaler Verband sind und Mitglieder, Schulen und Partner weltweit vertreten, kann es in Einzelfällen zu einer Übermittlung von personenbezogenen Daten in Länder außerhalb der EU/des EWR kommen (z. B. zur Koordination internationaler Events oder zur Kommunikation mit Landesvertretungen).\n\nIn solchen Fällen achten wir besonders darauf, dass\n\nentweder ein Angemessenheitsbeschluss der EU-Kommission vorliegt oder\n\ngeeignete Garantien nach Art. 46 DSGVO bestehen (z. B. EU-Standardvertragsklauseln) oder\n\neine Einwilligung der betroffenen Person vorliegt bzw. eine andere gesetzliche Grundlage besteht.\n\n17. Speicherdauer und Löschung der Daten\n\nWir verarbeiten und speichern personenbezogene Daten nur für den Zeitraum, der zur Zweck­erfüllung erforderlich ist oder sofern dies in Gesetzen, Verordnungen oder anderen Vorschriften vorgesehen ist.\n\nKriterien für die Speicherdauer sind u. a.:\n\nDauer der Mitgliedschaft oder Zusammenarbeit\n\ngesetzliche Aufbewahrungspflichten (z. B. handels- und steuerrechtlich meist 6–10 Jahre)\n\nBedeutung für die Dokumentation sportlicher Leistungen (z. B. Hall-of-Fame-Einträge, historische Ranglisten)\n\nNach Wegfall des Zwecks bzw. Ablauf gesetzlicher Fristen werden die Daten gelöscht oder anonymisiert.\n\n18. Datensicherheit\n\nWir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um deine Daten gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder unbefugten Zugriff zu schützen.\n\nUnsere Webseite verwendet in der Regel SSL-/TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennst du z. B. an „https://“ und einem Schloss-Symbol im Browser.\n\n19. Deine Rechte als betroffene Person\n\nDir stehen nach der DSGVO insbesondere folgende Rechte zu:\n\nAuskunft (Art. 15 DSGVO)\nDu kannst Auskunft darüber verlangen, ob und welche personenbezogenen Daten wir über dich verarbeiten.\n\nBerichtigung (Art. 16 DSGVO)\nDu kannst die Berichtigung unrichtiger oder Vervollständigung unvollständiger Daten verlangen.\n\nLöschung (Art. 17 DSGVO)\nDu kannst unter bestimmten Voraussetzungen die Löschung deiner Daten verlangen („Recht auf Vergessenwerden“).\n\nEinschränkung der Verarbeitung (Art. 18 DSGVO)\nDu kannst in bestimmten Fällen die Einschränkung der Verarbeitung verlangen.\n\nDatenübertragbarkeit (Art. 20 DSGVO)\nDu kannst verlangen, dass wir dir die Daten, die du uns bereitgestellt hast, in einem strukturierten, gängigen und maschinenlesbaren Format übermitteln oder an einen anderen Verantwortlichen übertragen.\n\nWiderspruchsrecht (Art. 21 DSGVO)\nDu hast das Recht, aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit gegen die Verarbeitung deiner personenbezogenen Daten, die wir auf Grundlage von Art. 6 Abs. 1 lit. e oder f DSGVO vornehmen, Widerspruch einzulegen.\nWir verarbeiten die personenbezogenen Daten dann nicht mehr, es sei denn, es liegen zwingende schutzwürdige Gründe vor oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.\n\nWiderruf von Einwilligungen (Art. 7 Abs. 3 DSGVO)\nEine einmal erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.\n\nBeschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO)\nDu hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren, wenn du der Ansicht bist, dass die Verarbeitung der dich betreffenden Daten gegen Datenschutzrecht verstößt.\n\n20. Pflicht zur Bereitstellung von Daten\n\nIn manchen Fällen ist die Bereitstellung personenbezogener Daten erforderlich, z. B. zur:\n\nAnmeldung zu Turnieren, Seminaren oder Veranstaltungen\n\nBearbeitung eines Mitgliedsantrags\n\nErfüllung vertraglicher oder gesetzlicher Pflichten\n\nWenn du die erforderlichen Daten nicht bereitstellst, kann es sein, dass wir die gewünschte Leistung (z. B. Teilnahme an einem Turnier, Mitgliedschaft, Nutzung des Login-Bereichs) nicht erbringen können.\n\n21. Änderungen dieser Datenschutzerklärung\n\nWir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder Änderungen unserer Leistungen (z. B. Einführung neuer Dienste) widerspiegelt.\n\nFür deinen erneuten Besuch gilt dann die jeweils aktuelle Version der Datenschutzerklärung.\n\nStand: 11.12.2025',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(3,2,'hausordnung','1.0','Dojo Regeln (Dojokun)','Hausordnung der Tiger & Dragon Association – International\n\nDie nachfolgenden Regeln dienen der Sicherheit, Sauberkeit, Fairness und einem respektvollen Miteinander im gesamten Trainings- und Veranstaltungsbetrieb der Tiger & Dragon Association – International (im Folgenden „TDA Int’l“).\n\nMit dem Betreten der Trainingsräume, Hallen oder Veranstaltungsorte erkennt jeder Teilnehmer, Besucher, Schüler, Trainer und Angehörige diese Hausordnung an.\n\n1. Allgemeines Verhalten\n\nRespekt, Höflichkeit und ein freundlicher Umgangston sind verpflichtend.\n\nAnweisungen des Trainers, der Aufsichtspersonen und des Veranstalters sind unbedingt zu befolgen.\n\nJede Form von Gewalt, Diskriminierung, Mobbing, Provokation oder respektlosem Verhalten wird nicht toleriert.\n\nBesucher und Teilnehmer haben sich so zu verhalten, dass niemand gefährdet, gestört oder beeinträchtigt wird.\n\nAlkohol, Drogen und andere berauschende Mittel sind auf dem Gelände verboten. Personen unter Einfluss solcher Substanzen werden vom Training ausgeschlossen.\n\n2. Sauberkeit & Ordnung\n\nDie Trainingsräume sind sauber zu halten.\n\nSchuhe sind nur in den dafür vorgesehenen Bereichen erlaubt – auf der Matte herrscht Barfußpflicht (Ausnahmen: medizinische Gründe, spezielle Matten-Schuhe).\n\nTaschen, Kleidung und persönliche Gegenstände sind ordnungsgemäß abzulegen und keine Stolpergefahr zu verursachen.\n\nJeder ist für die Sauberkeit seines Platzes und seiner Ausrüstung selbst verantwortlich.\n\nMüll bitte in die vorgesehenen Behälter werfen.\n\n3. Kleidung & Ausrüstung\n\nEs ist ordnungsgemäße Trainingskleidung zu tragen (z. B. Gi, Hose, Verbandskleidung, Schul-T-Shirt).\n\nDie Kleidung muss sauber, intakt und geruchsneutral sein.\n\nSchutzausrüstung (z. B. Handschuhe, Mundschutz, Tiefschutz, Schienbeinschoner) ist bei bestimmten Trainingseinheiten verpflichtend.\n\nSchmuck (Ringe, Ketten, Ohrringe, Piercings etc.) ist aus Sicherheitsgründen abzulegen oder abzukleben.\n\nLängere Haare müssen zusammengebunden sein.\n\n4. Sicherheit & Gesundheit\n\nTraining erfolgt stets auf eigene Gefahr; jeder achtet auf die eigenen körperlichen Grenzen.\n\nVerletzungen oder gesundheitliche Probleme müssen dem Trainer sofort gemeldet werden.\n\nDas Trainieren mit ansteckenden Krankheiten, offenen Wunden oder Fieber ist nicht erlaubt.\n\nGefährliche Techniken dürfen nur unter Aufsicht eines Trainers ausgeführt werden.\n\nWildes, unkontrolliertes oder aggressives Verhalten führt zum sofortigen Ausschluss aus dem Training.\n\n5. Matten- und Trainingsregeln\n\nDie Matte darf nur mit sauber gewaschenen Füßen betreten werden.\n\nEssen, Trinken (außer Wasser) und Kaugummi sind auf der Matte verboten.\n\nDas Verlassen der Matte während des Trainings muss beim Trainer angezeigt werden.\n\nSparring findet nur mit Erlaubnis des Trainers statt und unter Beachtung der festgelegten Regeln.\n\nEin fairer, verantwortungsvoller Umgang mit Trainingspartnern ist Pflicht.\n\n6. Verhalten gegenüber Trainern & Schülern\n\nDer Trainer ist während der Trainingseinheit weisungsbefugt.\n\nKritik oder Hinweise sind respektvoll und ausschließlich sachlich zu äußern.\n\nSchüler unterstützen und respektieren sich gegenseitig – unabhängig von Stil, Gürtelgrad, Herkunft, Geschlecht oder körperlicher Verfassung.\n\nDie höhere Graduierung verpflichtet zu Vorbildverhalten.\n\n7. Minderjährige Teilnehmer\n\nEltern oder Erziehungsberechtigte tragen die Verantwortung für die Aufsicht ihrer Kinder außerhalb des Trainings.\n\nKinder dürfen die Matten, Geräte und Räumlichkeiten nicht unbeaufsichtigt nutzen.\n\nUnnötiges Herumrennen im Dojo oder Wartebereich ist zu vermeiden.\n\nEltern dürfen das Training beobachten, aber die Einheit nicht stören.\n\n8. Geräte & Einrichtung\n\nTrainingsgeräte dürfen nur sachgerecht und vorsichtig benutzt werden.\n\nBeschädigungen sind sofort zu melden.\n\nMutwillige Beschädigungen führen zu Schadensersatzforderungen.\n\nGeräte müssen nach Benutzung an ihren Platz zurückgelegt werden.\n\n9. Garderobe & Wertsachen\n\nFür verloren gegangene oder gestohlene Gegenstände übernimmt TDA Int’l keine Haftung.\n\nWertsachen sind selbst zu sichern oder nicht mitzuführen.\n\nDer Umkleidebereich ist sauber zu halten.\n\n10. Fotos, Videos & Öffentlichkeitsarbeit\n\nDas Filmen oder Fotografieren im Dojo ist nur mit Erlaubnis des Trainers oder Verbandes erlaubt.\n\nBei offiziellen Veranstaltungen dürfen von TDA Int’l Fotos und Videos für Öffentlichkeitsarbeit erstellt werden.\n\nTeilnehmer können der Verwendung widersprechen, sofern keine berechtigten Interessen entgegenstehen.\n\n11. Teilnahmeausschluss & Sanktionen\n\nBei Verstößen gegen diese Hausordnung kann TDA Int’l folgende Maßnahmen ergreifen:\n\nmündliche Verwarnung\n\nschriftliche Verwarnung\n\nAusschluss aus der Trainingseinheit\n\ntemporärer Trainingsverweis\n\nHausverbot\n\nfristlose Beendigung der Mitgliedschaft\n\nEin Anspruch auf Rückerstattung der Beiträge besteht nicht.\n\n12. Notfälle\n\nNotausgänge dürfen nicht blockiert werden.\n\nIm Notfall ist den Anweisungen des Personals Folge zu leisten.\n\nErste-Hilfe-Material ist nur im Ernstfall zu verwenden.\n\n13. Gültigkeit\n\nDiese Hausordnung gilt für:\n\nalle Trainingsräume und Hallen\n\nOutdoor-Trainingsbereiche\n\nWettkampf- und Eventorte\n\nSeminarräume\n\nVeranstaltungen, Turniere und Prüfungen\n\nalle Teilnehmer, Besucher und Mitglieder der Tiger & Dragon Association – International\n\nMit dem Betreten der Räumlichkeiten bzw. Teilnahme an Aktivitäten wird die Hausordnung anerkannt.',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(4,2,'haftung','1.0','Haftungsausschluss','Haftungsausschluss der Tiger & Dragon Association – International\n1. Allgemeines\n\nDie Teilnahme an sämtlichen Angeboten, Leistungen und Aktivitäten der Tiger & Dragon Association – International (im Folgenden „TDA Int’l“) erfolgt grundsätzlich auf eigene Gefahr.\nDies umfasst insbesondere:\n\nTurniere und Wettkämpfe\n\nTrainings, Kurse, Workshops, Lehrgänge und Seminare\n\nHall-of-Fame-Veranstaltungen und Ehrungen\n\nPrüfungen, Graduierungen und Sparrings\n\nTrainingscamps und Outdoor-Aktivitäten\n\nVereins- und Verbandsveranstaltungen aller Art\n\nMitgliedschaften und Instructor-Programme\n\nFoto-, Video- und Medienaufnahmen\n\nsonstige sportliche oder gemeinschaftliche Veranstaltungen\n\nMit der Teilnahme erkennt jeder Teilnehmer, Erziehungsberechtigter oder Vertreter diesen Haftungsausschluss vollständig an.\n\n2. Gesundheitliche Voraussetzungen und Eigenverantwortung\n\nJeder Teilnehmer bestätigt, dass er:\n\nkörperlich und geistig in der Lage ist, an der jeweiligen Aktivität teilzunehmen,\n\nkeine gesundheitlichen Einschränkungen verheimlicht, die die Teilnahme riskant machen könnten (z. B. Herz-/Kreislaufprobleme, Asthma, Verletzungen, Operationen, Medikamente),\n\nin ausreichender körperlicher Verfassung für Kampfkunst/Kampfsport ist,\n\nselbstständig für angemessene Sportkleidung, Schutzausrüstung und gesundheitliche Vorsorge sorgt.\n\nDie Teilnahme setzt voraus, dass der Teilnehmer sein Training auf eigene Verantwortung gestaltet und auf Warnsignale seines Körpers achtet.\nIm Zweifel ist die Teilnahme zu unterlassen und medizinischer Rat einzuholen.\n\n3. Risiken bei Kampfkunst, Kampfsport & sportlichen Aktivitäten\n\nKampfkunst, Kampfsport und sportliche Bewegungsformen sind mit natürlichen Verletzungsrisiken verbunden, einschließlich, aber nicht beschränkt auf:\n\nPrellungen, Zerrungen, Verstauchungen\n\nVerletzungen der Bänder, Muskeln und Gelenke\n\nKnochenbrüche\n\nKopfverletzungen, Bewusstlosigkeit, Gehirnerschütterungen\n\nAtemnot, Kreislaufprobleme\n\nVerletzungen durch Dritte oder Trainingspartner\n\nSchäden an persönlichem Eigentum\n\nJeder Teilnehmer erklärt ausdrücklich, dass er sich dieser Risiken bewusst ist und sie eigenverantwortlich in Kauf nimmt.\n\n4. Haftung der TDA Int’l\n\nDie Tiger & Dragon Association – International haftet nur im Rahmen der gesetzlichen Bestimmungen und ausschließlich bei:\n\nvorsätzlichem oder grob fahrlässigem Verhalten\n\nVerletzung von Leben, Körper oder Gesundheit, die auf fahrlässiger oder vorsätzlicher Pflichtverletzung beruhen\n\nzwingenden gesetzlichen Haftungsvorschriften (z. B. Produkthaftungsgesetz)\n\nIn allen anderen Fällen ist eine Haftung ausgeschlossen, insbesondere für:\n\neinfache Fahrlässigkeit\n\nVerletzungen, die durch sporttypische Risiken entstehen\n\nHandlungen Dritter (Teilnehmer, Zuschauer, Vereine, Trainer, Schiedsrichter)\n\nSchäden durch fehlende oder mangelhafte Angabe gesundheitlicher Einschränkungen\n\nselbstverschuldete Unfälle\n\nVerlust oder Beschädigung von Wertgegenständen, Kleidung oder Ausrüstung\n\nSchäden aufgrund höherer Gewalt (z. B. Wetter, Stromausfälle, technische Störungen)\n\n5. Haftungsausschluss für Turniere & Wettkämpfe\n\nBei Turnieren und Wettkämpfen bestätigt jeder Teilnehmer bzw. dessen Erziehungsberechtigter:\n\nDie Teilnahme erfolgt freiwillig und auf eigenes Risiko.\n\nDie Regeln, Sicherheitsvorschriften und Anweisungen der Offiziellen werden beachtet.\n\nDer Veranstalter übernimmt keine Haftung für Schäden, die durch Gegner, internes oder externes Fehlverhalten, Regelverstöße oder unvorhersehbare Kampfverläufe entstehen.\n\nDer Teilnehmer trägt selbst die Verantwortung für die vorgeschriebene Schutzausrüstung.\n\nEine gültige Krankenversicherung ist Voraussetzung.\n\nDie TDA Int’l haftet nicht für Unfälle oder Verletzungen, die trotz eines regelkonformen Ablaufs auftreten.\n\n6. Haftungsausschluss für Seminare, Workshops & Training\n\nBei Trainings, Seminaren, Camps und Lehrgängen gilt:\n\nÜbungen können physische und psychische Belastungen mit sich bringen.\n\nJeder hat eigenverantwortlich zu prüfen, ob er die Übung sicher ausführen kann.\n\nDer Trainer stellt lediglich Anleitungen bereit – eine fehlerfreie Ausführung kann nicht garantiert werden.\n\nDer Teilnehmer trägt die Verantwortung, auf eigene Grenzen zu achten.\n\nFür Schäden durch unsachgemäße Selbstüberschätzung wird keine Haftung übernommen.\n\n7. Minderjährige Teilnehmer\n\nErziehungsberechtigte erkennen an:\n\ndass sie die Aufsichtspflicht gegenüber ihren Kindern selbst tragen, soweit diese nicht durch einen Trainer oder Betreuer übernommen wird,\n\ndass sie für Schäden haften, die ihre Kinder anderen zufügen,\n\ndass sie Risiken des Kampfsports kennen und akzeptieren,\n\ndass sie gesundheitliche Einschränkungen ihres Kindes dem Veranstalter mitteilen.\n\n8. Haftung für Ausrüstung & Eigentum\n\nDie TDA Int’l übernimmt keine Verantwortung für:\n\nVerlust oder Diebstahl von Kleidung, Equipment oder Wertgegenständen\n\nBeschädigungen durch Fahrlässigkeit anderer Teilnehmer\n\nselbst mitgebrachte Trainingsgeräte oder Hilfsmittel\n\nJeder ist selbst für seine Gegenstände verantwortlich.\n\n9. Foto-, Video- und Medienaufnahmen\n\nBei allen Veranstaltungen kann die TDA Int’l Foto- und Videoaufnahmen erstellen bzw. erstellen lassen.\n\nMit der Teilnahme erklärt jeder Teilnehmer bzw. Erziehungsberechtigte:\n\nEr ist einverstanden, dass Aufnahmen im Rahmen der Vereins-/Verbandsarbeit veröffentlicht werden dürfen (Website, Social Media, Turnierberichte, Printmedien usw.).\n\nEin Widerruf ist möglich, jedoch nicht rückwirkend für bereits veröffentlichte Materialien.\n\nBei Portrait- oder individuellen Aufnahmen kann eine gesonderte Einwilligung erforderlich sein.\n\n10. Verhalten, Regelverstöße & Ausschluss von der Teilnahme\n\nDie TDA Int’l behält sich das Recht vor, Teilnehmer ohne Anspruch auf Rückerstattung auszuschließen, wenn:\n\nSicherheitsanweisungen missachtet werden,\n\ngesundheitliche Risiken verschwiegen wurden,\n\naggressives, gefährliches oder respektloses Verhalten gezeigt wird,\n\neine Gefährdung anderer Personen besteht.\n\n11. Höhere Gewalt & Veranstaltungsänderungen\n\nFür Ausfälle, Änderungen oder Abbruch einer Veranstaltung aufgrund von Ereignissen außerhalb unserer Kontrolle (z. B. Wetter, Krankheit des Trainers, technische Störungen, Pandemien) wird keine Haftung übernommen.\n\nBereits gezahlte Gebühren können nach Ermessen des Veranstalters erstattet, gutgeschrieben oder als Teilnahmeberechtigung für einen späteren Termin anerkannt werden.\n\n12. Versicherungen\n\nJeder Teilnehmer ist selbst dafür verantwortlich, über ausreichende Kranken-, Unfall- und Haftpflichtversicherung zu verfügen.\n\nDer Veranstalter übernimmt nicht die Kosten für Verletzungen oder Krankenhausaufenthalte, sofern dies nicht gesetzlich vorgeschrieben ist.\n\n13. Salvatorische Klausel\n\nSollten einzelne Bestimmungen dieses Haftungsausschlusses unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.\nAn die Stelle der unwirksamen Klausel tritt eine Regelung, die dem wirtschaftlichen Zweck am nächsten kommt.\n\n14. Anerkennung des Haftungsausschlusses\n\nMit der Teilnahme an jeglichen Aktivitäten, Veranstaltungen oder Programmen der Tiger & Dragon Association – International erkennt der Teilnehmer bzw. dessen Erziehungsberechtigter diesen Haftungsausschluss vollständig und verbindlich an.',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(5,2,'widerruf','1.0','Widerrufsbelehrung','Widerrufsbelehrung mit Hinweis auf sofortigen Trainingsbeginn\n\nWiderrufsrecht\n\nDu hast das Recht, deine Mitgliedschaft innerhalb von 14 Tagen ohne Angabe von Gründen zu widerrufen.\n\nDie Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.\n\nUm dein Widerrufsrecht auszuüben, musst du uns (Tiger & Dragon Association – International, Geigelsteinstr. 14, 84137 Vilsbiburg, info@tda-intl.com\n) mittels einer eindeutigen Erklärung (z. B. E-Mail oder Brief) über deinen Entschluss informieren, die Mitgliedschaft zu widerrufen.\n\nAusnahme: Verzicht auf das Widerrufsrecht bei sofortigem Trainingsbeginn\n\nWenn du ausdrücklich verlangst, dass die Mitgliedschaft bereits vor Ablauf der Widerrufsfrist beginnt und du sofort am Training teilnehmen möchtest, gilt Folgendes:\n\nDu bestätigst mit deinem Antrag ausdrücklich, dass du vor Ablauf der Widerrufsfrist sofort mit dem Training beginnen möchtest.\n\nDu bestätigst außerdem, dass dir bewusst ist, dass du bei vollständiger Vertragserfüllung durch uns dein Widerrufsrecht verlierst.\n\nFür Leistungen, die wir bis zum Zeitpunkt des Widerrufs bereits erbracht haben, musst du ggf. einen angemessenen anteiligen Betrag zahlen.\n\nBeispiel:\nWenn du nach Vertragsabschluss sofort trainierst und erst später innerhalb der Frist widerrufst, wird nur die bereits in Anspruch genommene Zeit berechnet.\n\nDiese Erklärung ist erforderlich, weil du sonst laut Gesetz erst nach Ablauf der 14 Tage trainieren dürftest.\n\nFolgen des Widerrufs\n\nWenn du die Mitgliedschaft innerhalb der Widerrufsfrist widerrufst, erstatten wir dir alle Zahlungen, abzüglich der anteiligen Kosten für bereits genutzte Leistungen, innerhalb von 14 Tagen ab Eingang deines Widerrufs.\n\nMuster-Widerrufsformular\n\n(Wenn du den Vertrag widerrufen möchtest, fülle folgendes Formular aus und sende es zurück.)\n\nAn:\nTiger & Dragon Association – International\nGeigelsteinstr. 14\n84137 Vilsbiburg\nE-Mail: info@tda-intl.com\n\nHiermit widerrufe ich die von mir abgeschlossene Mitgliedschaft.\n\nName: _______________________________________\n\nAnschrift: __________________________________\n\nDatum des Vertragsabschlusses: _______________\n\nDatum des Widerrufs: ________________________\n\nUnterschrift (bei Mitteilung auf Papier): ___________________________',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(6,2,'sonstiges','1.0','Impressum','Impressum\n\nAngaben gemäß § 5 TMG / § 55 RStV\n\nTiger & Dragon Association – International\nInhaber / Verantwortlicher: Sascha Schreiner\nGeigelsteinstr. 14\n84137 Vilsbiburg\nDeutschland\n\nKontakt:\nTelefon: 01575 2461776\nE-Mail: info@tda-intl.com\n\nWebseite: www.tda-intl.com\n\nVertretungsberechtigt\n\nSascha Schreiner\n(Inhaber, Verbandrepräsentant)\n\nUmsatzsteuer / Steuernummer\n\n\n\nInhaltlich Verantwortlicher gemäß § 55 Abs. 2 RStV\n\nSascha Schreiner\nGeigelsteinstr. 14\n84137 Vilsbiburg\n\nHaftung für Inhalte\n\nAls Dienstanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.\nNach §§ 8–10 TMG sind wir jedoch nicht verpflichtet,\n\nübermittelte oder gespeicherte fremde Informationen zu überwachen oder\n\nnach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.\n\nVerpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.\nEine Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich.\nBei Bekanntwerden entsprechender Rechtsverletzungen entfernen wir diese Inhalte umgehend.\n\nHaftung für Links\n\nUnser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.\nDeshalb können wir für diese fremden Inhalte keine Gewähr übernehmen.\n\nFür die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.\nBei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links sofort.\n\nUrheberrecht\n\nDie auf dieser Website veröffentlichten Inhalte, Bilder, Texte, Grafiken, Logos und Designs unterliegen dem deutschen Urheberrecht.\nVervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Rechteinhabers.\n\nDownloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.\n\nMarken- und Schutzrechte\n\n„Tiger & Dragon Association“ sowie sämtliche Logos, Abzeichen und Titel können geschützte Marken oder eingetragene Kennzeichen sein.\nJede unbefugte Nutzung ist untersagt.\n\nOnline-Streitbeilegung\n\nDie Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:\nhttps://ec.europa.eu/consumers/odr\n\nWir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.\n\nGender-Hinweis\n\nAus Gründen der Lesbarkeit wird in Texten auf dieser Seite überwiegend die männliche Form gewählt.\nAlle personenbezogenen Bezeichnungen gelten gleichermaßen für alle Geschlechter.',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(7,3,'agb','1.0','AGB (Allgemeine Geschäftsbedingungen)','Allgemeine Geschäftsbedingungen (AGB)\n\nder Kampfsportschule Schreiner\nOhmstraße 14, 84137 Vilsbiburg\n(im Folgenden Schule, Anbieter)\n\nStand: 31.10.2025\n\n1. Geltung, Vertragsparteien, Änderungen\n\n1.1. Diese AGB gelten für alle Verträge, Leistungen, Kurse und Mitgliedschaften, die zwischen der Kampfsportschule Schreiner (im Folgenden Schule) und den Teilnehmenden bzw. Mitgliedern (im Folgenden Mitglied, Teilnehmer, Kunde) geschlossen werden.\n\n1.2. Abweichende Bedingungen des Kunden werden ausdrücklich zurückgewiesen, es sei denn, die Schule hat ihnen schriftlich ausdrücklich zugestimmt.\n\n1.3. Einzelverträge und schriftliche Vereinbarungen haben Vorrang vor diesen AGB.\n\n1.4. Änderungen oder Ergänzungen dieser AGB bedürfen zur Wirksamkeit der Schriftform, sofern nicht ausdrücklich etwas anderes geregelt ist.\n\n1.5. Die Schule behält sich vor, einzelne Regelungen dieser AGB mit Wirkung für die Zukunft zu ändern. Änderungen werden dem Mitglied mindestens vier Wochen vor Inkrafttreten in Textform (z.?B. E?Mail, Aushang, Post) bekannt gegeben. Widerspricht das Mitglied der Änderung nicht schriftlich bis zum Inkrafttreten, gelten die Änderungen als angenommen. Auf die Bedeutung der Widerspruchsfrist wird die Schule den Teilnehmenden bei Bekanntgabe besonders hinweisen.\n\n2. Vertragsabschluss, Teilnahmevoraussetzungen\n\n2.1. Der Vertrag über die Teilnahme an Kursen, das Training oder eine Mitgliedschaft kommt zustande durch Unterzeichnung eines schriftlichen Vertrags oder eines Anmeldeformulars oder  soweit angeboten  durch Elektronische Anmeldung mit Bestätigung durch die Schule.\n\n2.2. Minderjährige (unter 18 Jahren) dürfen einen Vertrag nur mit Einwilligung der gesetzlichen Vertreter schließen. Diese müssen durch Unterschrift zustimmen.\n\n2.3. Vor Beginn der Teilnahme ist ein Gesundheitsfragebogen/Erklärung zur Sporttauglichkeit durch den Teilnehmenden oder  bei Minderjährigen  durch die gesetzlichen Vertreter auszufüllen. Der Teilnehmende bestätigt damit, dass keine medizinischen Einwände gegen die Teilnahme bestehen, oder er legt ein ärztliches Attest vor, wenn gesundheitliche Risiken bestehen.\n\n2.4. Der Anbieter kann die Teilnahme verweigern, wenn der Gesundheitszustand des Teilnehmenden Bedenken aufwirft, insbesondere wenn eine Gefährdung für sich oder andere bestehen könnte.\n\n3. Leistungsumfang und Nutzung\n\n3.1. Gegenstand der Leistungen sind Trainings-, Kurs- und Unterrichtsangebote im Bereich Kampfsport, Selbstverteidigung, Fitness-Training etc., sowie gegebenenfalls Zusatzleistungen (z.?B. Personal Training, Seminare, Prüfungen).\n\n3.2. Der konkrete Leistungsumfang ergibt sich aus dem Vertrag bzw. der Leistungsbeschreibung im Angebot der Schule.\n\n3.3. Die Nutzung der Räumlichkeiten, der Ausstattung und Hilfsmittel erfolgt nur zu dem im Vertrag festgelegten Umfang und nach Maßgabe der Hausordnung.\n\n3.4. Eine Übertragung der Mitgliedschaft oder der Teilnahmeberechtigung auf Dritte ist ausgeschlossen, sofern nichts anderes ausdrücklich vereinbart ist.\n\n4. Pflichten der Mitglieder / Teilnehmer\n\n4.1. Die Mitglieder verpflichten sich insbesondere:\n\ndie Anweisungen der Trainer, Übungsleiter oder des Personals zu befolgen;\n\nsich an die Hausordnung sowie Sicherheits- und Hygienevorschriften zu halten;\n\nkeine Handlungen vorzunehmen, die Gefahr für Leib, Leben oder Eigentum anderer darstellen;\n\nvor oder während der Teilnahme auftretende Unwohlsein, gesundheitliche Beschwerden oder Verletzungen unverzüglich dem Trainer oder der Schule anzuzeigen;\n\neigenes Trainingsmaterial (z.?B. geeignete Kleidung, Schutzausrüstung, Getränke) mitzubringen, sofern nicht durch die Schule gestellt;\n\nSauberkeit, Ordnung und Rücksicht auf andere Teilnehmende zu wahren.\n\n4.2. Bei groben oder wiederholten Pflichtverletzungen kann die Schule den Vertrag außerordentlich kündigen (siehe Ziffer 8).\n\n4.3. Das Mitglied ist verpflichtet, Änderungen seiner Kontakt- oder Bankdaten unverzüglich mitzuteilen.\n\n5. Beiträge, Preise, Zahlung\n\n5.1. Die Höhe der Beiträge, Kursgebühren und Zusatzkosten ergibt sich aus der aktuellen Preisliste bzw. dem Vertrag.\n\n5.2. Die Beiträge sind regelmäßig im Voraus  meist monatlich, vierteljährlich oder jährlich  zu entrichten. Der genaue Fälligkeitstermin ergibt sich aus dem Vertrag.\n\n5.3. Bei Zahlungsverzug gelten folgende Regelungen:\n\nNach Mahnung wird eine Mahngebühr (fester Betrag oder Prozentsatz) erhoben;\n\nBei Nichtzahlung kann die Schule den Zutritt verweigern, bis der Rückstand beglichen ist;\n\nNach einer bestimmten Frist (z.?B. 23 Monate) kann die Schule den Vertrag kündigen und die Rückstände und den restlichen ausstehenden Betrag bis zur Beendigung des Vertrages einfordern.\n\n5.4. Bei Verträgen über einen bestimmten Zeitraum (z.?B. Jahresvertrag) wird bei vorzeitiger Beendigung durch das Mitglied keine anteilige Rückerstattung geleistet, sofern nicht ausdrücklich anders vereinbart oder gesetzlich vorgeschrieben.\n\n5.5. Sonderleistungen oder Zusatzangebote (z.?B. Privatstunden, Prüfungsgebühren) werden gesondert berechnet und sind ebenfalls fristgerecht zu zahlen.\n\n5.6. Die Schule behält sich vor, Beiträge und Gebühren anzupassen (z.?B. wegen gestiegener Kosten). Eine Erhöhung wird dem Mitglied mindestens vier Wochen vorher in Textform mitgeteilt. Widerspricht das Mitglied nicht fristgerecht schriftlich, gilt die Erhöhung als genehmigt. Ein Sonderkündigungsrecht wird nicht gewährleistet.\n\n6. Vertragsdauer und Kündigung\n\n6.1. Vertragsdauer und Kündigungsfristen ergeben sich aus dem jeweiligen Vertrag (z.?B. Monat auf Monatsbasis, Mindestvertragsdauer, Laufzeit, Verlängerung).\n\n6.2. Die Kündigung bedarf der Schriftform (Brief, E-Mail,  sofern im Vertrag zugelassen  elektronisch), sofern nicht anders vereinbart.\n\n6.3. Bei Verträgen mit Mindestlaufzeit ist eine ordentliche Kündigung frühestens zum Ende der Mindestlaufzeit möglich. Danach gilt meist eine Kündigungsfrist (z.?B. 13 Monate).\n\n6.4. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor:\n\nwenn eine Partei ihre vertraglichen Pflichten schwerwiegend verletzt;\n\nbei erheblicher Gesundheitsgefährdung des Mitglieds;\n\nbei Insolvenz oder Einstellung des Geschäftsbetriebs der Schule.\n\n7. Unterbrechung / Ruhen des Vertrages\n\n7.1. In bestimmten Ausnahmefällen (z.?B. längere Krankheit, Schwangerschaft, Auslandsaufenthalt) kann der Vertrag auf schriftlichen Antrag und Nachweis befristet ruhen. Die Mindestdauer, Höchstdauer und Bedingungen für einen solchen Freeze sind im Vertrag oder der Preisliste festzulegen.\n\n7.2. Für Ruhtage ist in der Regel ein Entgelt bzw. Verwaltungskosten oder ein reduzierter Beitrag zu erheben.\n\n7.3. Während der Ruhezeiten besteht kein Anspruch auf Nutzung der Leistungen, es sei denn, es wird ausdrücklich etwas Anderes vereinbart.\n\n8. Haftung, Versicherung, Ausschluss\n\n8.1. Die Schule haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung oder auf Vorsatz/Grobe Fahrlässigkeit der Schule oder ihrer Erfüllungsgehilfen beruhen.\n\n8.2. Für sonstige Schäden haftet die Schule nur bei Vorsatz oder grober Fahrlässigkeit, es sei denn, eine Pflichtverletzung betrifft eine wesentliche Vertragspflicht (Kardinalpflicht). In diesem Fall ist die Haftung auf den typischerweise vorhersehbaren Schaden begrenzt.\n\n8.3. Eine Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit gesetzlich zulässig.\n\n8.4. Insbesondere haftet die Schule nicht für:\n\nVerletzungen oder Schäden, die durch Zuwiderhandlung gegen Anweisungen, Regeln oder Sicherheitsvorgaben oder durch den Körperkontakt im Kampftraining entstehen;\n\nSchäden, die durch eigenes fahrlässiges Verhalten des Mitglieds verursacht werden;\n\nSchäden an mitgebrachten Gegenständen oder Wertgegenständen (z.?B. Kleidung, Schmuck, elektronische Geräte), sofern nicht grobe Fahrlässigkeit oder Vorsatz vorliegt.\n\n8.5. Der Teilnehmende ist verpflichtet, eigene Unfall- und Haftpflichtversicherung zu haben, soweit möglich, und ggf. Schädenmeldungspflichten zu erfüllen.\n\n9. Aussetzung und Ersatztraining\n\n9.1. Die Schule kann aufgrund von Betriebsstörungen, behördlichen Anordnungen, außergewöhnlichen Ereignissen (z.?B. Unwetter, Pandemien), Krankheit von Trainern oder aus anderen wichtigen Gründen den Trainingsbetrieb ganz oder teilweise unterbrechen.\n\n9.2. In solchen Fällen kann die Schule nach Möglichkeit Ersatztermine oder alternative Angebote anbieten oder eine anteilige Gutschrift bzw. Beitragsminderung gewähren.\n\n9.3. Der Anspruch auf Ersatzleistung erlischt, wenn das Mitglied die Ersatzangebote nicht innerhalb einer angemessenen Frist in Anspruch nimmt, ohne ein berechtigtes Hindernis geltend zu machen.\n\n10. Widerrufsrecht für Verbraucher\n\n10.1. Sofern ein Vertrag online oder außerhalb von Geschäftsräumen mit einem Verbraucher geschlossen wird, steht dem Verbraucher ein gesetzliches Widerrufsrecht zu (vgl. §§ 312g, 355 BGB).\n\n10.2. Die Widerrufsbelehrung und die Bedingungen zum Widerruf sind im Vertrag bzw. in der Auftragsbestätigung getrennt darzustellen.\n\n10.3. Das Widerrufsrecht entfällt vollständig bei Verträgen zur Erbringung von Dienstleistungen (z.?B. Trainingsleistungen, Mitgliedschaften, Kurse), wenn der Vertrag für eine bestimmte Zeit abgeschlossen ist und die Ausführung der Dienstleistung mit Zustimmung des Verbrauchers beginnt und der Verbraucher seine Kenntnis bestätigt, dass er mit Beginn der Vertragserfüllung sein Widerrufsrecht verliert.\n\n11. Datenschutz\n\n11.1. Die Schule erhebt, verarbeitet und nutzt personenbezogene Daten der Mitglieder nur, soweit dies zur Durchführung des Vertrags nötig ist, gesetzlich erlaubt oder vom Mitglied ausdrücklich genehmigt ist.\n\n11.2. Nähere Einzelheiten zur Datenverarbeitung, Zweckbindung, Speicherung und Rechte der Betroffenen ergeben sich aus der gesonderten Datenschutzinformation / Datenschutzrichtlinie der Schule.\n\n12. Schlussbestimmungen, Salvatorische Klausel, Gerichtsstand, anwendbares Recht\n\n12.1. Sollten einzelne Bestimmungen dieser AGB unwirksam oder undurchführbar sein oder werden, bleibt die Gültigkeit der übrigen Bestimmungen unberührt. Die Parteien verpflichten sich, die unwirksame Regelung durch eine solche wirksame zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen möglichst nahekommt.\n\n12.2. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.\n\n12.3. Soweit gesetzlich zulässig und der Teilnehmende Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist, ist ausschließlicher Gerichtsstand der Sitz der Schule (Vilsbiburg). Andernfalls gelten die gesetzlichen Gerichtsstände.\n\n12.4. Änderungen oder Ergänzungen des Vertrags, einschließlich dieser Klausel, bedürfen der Schriftform.\n',NULL,'2025-12-15',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 21:14:53'),(8,3,'datenschutz','1.0','Datenschutzerklärung','1. Verantwortlicher\n\nKampfsportschule Schreiner  International\nInhaber / Verantwortlicher: Stephanie Schreiner\nAnschrift: Ohmstr. 14, 84137 Vilsbiburg, Deutschland\nTelefon: +49 (0)1575 2461776\nE-Mail: info@tda-vib.de\n\nWebseite: www.tda-vib.de\n\n(im Folgenden wir, uns oder TDA Intl)\n\n2. Geltungsbereich\n\nDiese Datenschutzerklärung informiert dich darüber, welche personenbezogenen Daten wir erheben, wenn du\n\nunsere Webseite www.tda-vib.de\n besuchst,\n\ndich oder deine Schule/deinen Verein zu unseren Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events oder anderen Events anmeldest,\n\nmit uns per E-Mail, Telefon, Kontaktformular oder auf andere Weise in Kontakt trittst,\n\nMitglied im Verband wirst oder als Partner/Instructor mit uns zusammenarbeitest.\n\nSie gilt insbesondere im Rahmen der Datenschutz-Grundverordnung (DSGVO) und des Bundesdatenschutzgesetzes (BDSG).\n\n3. Begriffe\n\nPersonenbezogene Daten sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen (z. B. Name, Adresse, E-Mail, IP-Adresse).\n\nVerarbeitung ist jeder Vorgang im Zusammenhang mit personenbezogenen Daten (z. B. Erheben, Speichern, Übermitteln, Löschen).\n\n4. Rechtsgrundlagen der Verarbeitung\n\nWir verarbeiten personenbezogene Daten auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO  Einwilligung\n\nArt. 6 Abs. 1 lit. b DSGVO  Vertragserfüllung oder vorvertragliche Maßnahmen (z. B. Turnieranmeldung, Mitgliedsantrag)\n\nArt. 6 Abs. 1 lit. c DSGVO  rechtliche Verpflichtung (z. B. Aufbewahrungspflichten)\n\nArt. 6 Abs. 1 lit. f DSGVO  berechtigtes Interesse\n(z. B. sichere Bereitstellung der Webseite, Organisation von Veranstaltungen, Außendarstellung, Verbandsverwaltung)\n\n5. Bereitstellung der Webseite und Server-Logfiles\n5.1 Art der Daten\n\nBeim Besuch unserer Webseite werden durch den von dir verwendeten Browser automatisch Informationen an unseren Server übermittelt und in Server-Logfiles gespeichert. Dies sind u. a.:\n\nIP-Adresse deines Endgeräts\n\nDatum und Uhrzeit des Zugriffs\n\naufgerufene Seite/Datei\n\nReferrer-URL (zuvor besuchte Seite, falls übermittelt)\n\nverwendeter Browser und Betriebssystem\n\nggf. Name deines Access-Providers\n\nDiese Daten werden nicht mit anderen Datenquellen zusammengeführt und nicht zur Identifizierung einzelner Personen verwendet.\n\n5.2 Zweck\n\nSicherstellung eines reibungslosen Verbindungsaufbaus der Webseite\n\nGewährleistung einer komfortablen Nutzung unserer Webseite\n\nAuswertung der Systemsicherheit und -stabilität\n\ntechnische Administration\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und stabilen Betrieb der Webseite).\n\n5.3 Speicherdauer\n\nServer-Logfiles werden in der Regel für 730 Tage gespeichert und anschließend automatisch gelöscht, sofern keine längere Aufbewahrung zu Beweiszwecken im Einzelfall erforderlich ist (z. B. bei Sicherheitsvorfällen).\n\n6. Cookies und Einwilligungs-Management\n6.1 Cookies\n\nUnsere Webseite kann sogenannte Cookies verwenden. Das sind kleine Textdateien, die auf deinem Endgerät gespeichert werden.\n\nArten von Cookies:\n\nTechnisch notwendige Cookies\nz. B. zur Sprachauswahl, Sitzungserkennung, Warenkorb-/Formularfunktionen, Login-Bereich\n? Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO oder § 25 Abs. 2 TTDSG\n\nOptionale Cookies (z. B. für Statistik/Analyse oder Marketing)  falls eingesetzt\n? Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 25 Abs. 1 TTDSG (nur mit Einwilligung)\n\n6.2 Cookie-Einwilligung\n\nSofern wir ein Cookie-Banner / Consent-Tool einsetzen, kannst du dort entscheiden, welchen Kategorien von Cookies du zustimmst. Deine Auswahl kannst du jederzeit über die entsprechenden Einstellungen im Consent-Tool oder in deinem Browser ändern.\n\n7. Kontaktaufnahme (E-Mail, Telefon, Kontaktformular)\n\nWenn du uns kontaktierst, z. B. per E-Mail, Telefon oder Kontaktformular, verarbeiten wir die von dir mitgeteilten Daten:\n\nName\n\nKontaktdaten (E-Mail, Telefonnummer)\n\nBetreff und Inhalt deiner Nachricht\n\nggf. Vereins-/Dojo-Name, Land, Funktion (Instructor, Schüler, Funktionär usw.)\n\nZweck der Verarbeitung ist die Bearbeitung deines Anliegens, Rückfragen und Kommunikation.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO, sofern deine Anfrage mit der Durchführung eines Vertrages oder vorvertraglicher Maßnahmen zusammenhängt (z. B. Turnieranmeldung, Mitgliedsantrag).\n\nArt. 6 Abs. 1 lit. f DSGVO, bei allgemeinen Anfragen (berechtigtes Interesse an effektiver Kommunikation).\n\nSpeicherdauer:\nWir speichern deine Anfrage, solange es zur Bearbeitung erforderlich ist. Danach werden die Daten regelmäßig gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.\n\n8. Mitgliedschaft, Verband, Schulen & Partner\n\nWenn du Mitglied bei TDA Intl wirst oder als Dojo/Schule/Instructor mit uns zusammenarbeitest, verarbeiten wir  je nach Rolle  insbesondere:\n\nStammdaten: Name, Adresse, Geburtsdatum, Kontaktdaten (Telefon, E-Mail)\n\nVerbandsbezogene Daten: Dojo-/Vereinsname, Stilrichtung(en), Position im Verband, Mitgliedsstatus, Funktion (Instructor, Schulleiter, Funktionär)\n\nVertrags- und Abrechnungsdaten: Bankverbindung, Zahlungsinformationen (z. B. Beitragszahlungen), ggf. Rechnungen\n\nKommunikationsdaten: Schriftwechsel im Zusammenhang mit der Mitgliedschaft/Kooperation\n\nZweck:\n\nVerwaltung von Mitgliedern, Schulen und Partnern\n\nDurchführung des Mitgliedschafts- oder Kooperationsverhältnisses\n\nOrganisation von Veranstaltungen, Ernennungen, Lizenzen, Instructor-Tätigkeiten\n\nAbrechnung und Beitragseinzug\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und ggf. Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten, z. B. steuerliche Aufbewahrung).\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Mitgliedschaft/Kooperation und darüber hinaus für gesetzliche Aufbewahrungsfristen (in der Regel 610 Jahre) gespeichert. Daten, die nicht mehr benötigt werden, werden gelöscht oder anonymisiert.\n\n9. Online-Anmeldung zu Turnieren, Seminaren, Hall of Fame & Events\n\nZur Anmeldung zu unseren Turnieren, Hall-of-Fame-Veranstaltungen, Seminaren, Charity-Events und weiteren Events erheben wir je nach Event folgende Daten von Teilnehmern, Trainern, Vereinen/Schulen:\n\nPersonendaten der Teilnehmer*innen:\nName, Vorname, Geburtsdatum, Geschlecht, Nationalität\n\nSportbezogene Daten:\nStilrichtung, Graduierung/Gürtel, Gewichtsklasse, Startkategorien, Wettkampfklassen, ggf. Leistungsstand\n\nKontaktdaten:\nAnschrift, E-Mail, Telefonnummer des Teilnehmers oder Vereins/Trainers\n\nVereins-/Dojo-Daten:\nName, Anschrift, Ansprechpartner, Verband, Land\n\nAbrechnungsdaten:\nTeilnahmegebühren, Zahlungsinformationen (z. B. Vermerk über Zahlungseingang  konkrete Zahlungsdaten beim Zahlungsdienstleister)\n\nZwecke der Verarbeitung:\n\nOrganisation und Durchführung der Veranstaltung\n\nErstellung von Startlisten, Pools, Kampffeldern und Zeitplänen\n\nErgebniserfassung, Ranglisten, Siegerehrungen, Urkunden\n\nKommunikation mit Teilnehmern, Vereinen und Offiziellen\n\nAbrechnung und ggf. Nachweis gegenüber Sponsoren, Partnern oder Verbänden\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung  Durchführung der Veranstaltung)\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer professionellen Organisation und sportlichen Auswertung)\n\nSpeicherdauer:\nDie Daten werden für die Dauer der Veranstaltungsorganisation sowie für die Dokumentation von Ergebnissen (z. B. Ranglisten, Jahreswertung, Hall of Fame) gespeichert. Soweit möglich, werden Langzeitauswertungen in anonymisierter oder pseudonymisierter Form geführt. Rechts- und steuerrelevante Daten bewahren wir gemäß der gesetzlichen Fristen auf.\n\n10. Hall of Fame, Berichterstattung, Fotos & Videos\n\nIm Rahmen von Turnieren, Seminaren, Hall-of-Fame-Veranstaltungen, Charity-Events und sonstigen Veranstaltungen erstellen wir ggf. Fotos und Videos, u. a. für:\n\nBerichte zu Veranstaltungen auf unserer Webseite, in Social Media, in Newslettern oder Printmedien\n\nDokumentation sportlicher Leistungen und Ehrungen\n\nArchivzwecke und Hall-of-Fame-Einträge\n\nDabei können Teilnehmer, Trainer, Offizielle, Gäste und Ehrengäste erkennbar sein.\n\nRechtsgrundlagen:\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Berichterstattung, Außendarstellung, Dokumentation des Verbandslebens)\n\nsoweit erforderlich: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. bei Portraitaufnahmen, Nahaufnahmen oder bestimmten Veröffentlichungen)\n\nWenn du nicht fotografiert werden möchtest oder mit einer Veröffentlichung nicht einverstanden bist, kannst du uns das möglichst frühzeitig mitteilen (z. B. an der Anmeldung, beim Fotografen oder per E-Mail). Bereits veröffentlichte Inhalte prüfen wir im Einzelfall und entfernen sie, sofern keine überwiegenden berechtigten Interessen entgegenstehen.\n\n11. Newsletter & Informationsmails (falls eingesetzt)\n\nSofern wir einen Newsletter oder regelmäßige Informationsmails anbieten, gilt:\n\nFür den Versand benötigen wir deine E-Mail-Adresse und ggf. deinen Namen.\n\nDie Anmeldung erfolgt in der Regel über ein Double-Opt-In-Verfahren: Erst nach Bestätigung deiner E-Mail-Adresse erhältst du den Newsletter.\n\nDu kannst dich jederzeit vom Newsletter abmelden, z. B. über einen Abmeldelink in jeder E-Mail oder durch Nachricht an uns.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung)\n\nSpeicherdauer:\nWir speichern deine Daten, bis du dich vom Newsletter abmeldest oder deine Einwilligung widerrufst.\n\n12. Nutzerkonten / Login-Bereich (falls vorhanden)\n\nWenn wir einen geschützten Login-Bereich für Vereine/Instruktoren/Teilnehmer anbieten, verarbeiten wir:\n\nZugangsdaten (Benutzername, Passwort  Passwort nur in verschlüsselter Form)\n\nRegistrierungsdaten (Name, E-Mail, Verein, Rolle im System)\n\nNutzungsdaten (z. B. erfasste Teilnehmer, Meldungen, Bearbeitungen im System)\n\nZweck: Bereitstellung des geschützten Bereichs, Verwaltung von Meldungen, Administration von Turnieren und Verbandsdaten.\n\nRechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzervertrag für den Login-Bereich) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherer Systemverwaltung).\n\n13. Zahlungsabwicklung (falls über Zahlungsdienstleister)\n\nSofern Teilnahmegebühren, Mitgliedsbeiträge oder andere Leistungen über Zahlungsdienstleister oder Kreditinstitute abgewickelt werden, werden die hierfür erforderlichen Daten (z. B. Name, Betrag, IBAN/BIC oder andere Zahlungsinformationen) an das jeweilige Unternehmen übermittelt.\n\nRechtsgrundlage:\n\nArt. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung  Zahlungsabwicklung)\n\nArt. 6 Abs. 1 lit. c DSGVO (gesetzliche Aufbewahrungspflichten)\n\nDie detaillierte Verarbeitung erfolgt beim jeweiligen Zahlungsdienstleister. Bitte beachte ergänzend deren Datenschutzhinweise.\n\n14. Webanalyse & Tracking (falls eingesetzt)\n\nSofern wir Webanalyse-Dienste (z. B. zur statistischen Auswertung der Nutzung unserer Webseite) verwenden, geschieht dies nur auf Grundlage von:\n\nArt. 6 Abs. 1 lit. a DSGVO (Einwilligung, falls Cookies/Tracking erforderlich) oder\n\nArt. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer bedarfsgerechten Gestaltung und Optimierung der Webseite), soweit dies ohne Einwilligung zulässig ist.\n\nDie konkrete Ausgestaltung (Dienstleister, Umfang der Datenverarbeitung, Speicherdauer, ggf. Drittlandtransfer) wird in einem separaten Abschnitt oder im Cookie-Banner erläutert, sobald diese Dienste eingesetzt werden.\n\n15. Empfänger der Daten / Auftragsverarbeiter\n\nWir geben personenbezogene Daten nur an Dritte weiter, soweit dies\n\nzur Vertragserfüllung notwendig ist (z. B. Dienstleister für IT, Hosting, Zahlungsabwicklung, Urkundendruck, Versand),\n\nwir dazu gesetzlich verpflichtet sind (z. B. Behörden, Finanzamt),\n\nes zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist oder\n\ndu eingewilligt hast.\n\nMit Dienstleistern, die in unserem Auftrag personenbezogene Daten verarbeiten, schließen wir Auftragsverarbeitungsverträge gemäß Art. 28 DSGVO.\n\n16. Datenübermittlung in Drittländer\n\nDa wir ein internationaler Verband sind und Mitglieder, Schulen und Partner weltweit vertreten, kann es in Einzelfällen zu einer Übermittlung von personenbezogenen Daten in Länder außerhalb der EU/des EWR kommen (z. B. zur Koordination internationaler Events oder zur Kommunikation mit Landesvertretungen).\n\nIn solchen Fällen achten wir besonders darauf, dass\n\nentweder ein Angemessenheitsbeschluss der EU-Kommission vorliegt oder\n\ngeeignete Garantien nach Art. 46 DSGVO bestehen (z. B. EU-Standardvertragsklauseln) oder\n\neine Einwilligung der betroffenen Person vorliegt bzw. eine andere gesetzliche Grundlage besteht.\n\n17. Speicherdauer und Löschung der Daten\n\nWir verarbeiten und speichern personenbezogene Daten nur für den Zeitraum, der zur Zweck­erfüllung erforderlich ist oder sofern dies in Gesetzen, Verordnungen oder anderen Vorschriften vorgesehen ist.\n\nKriterien für die Speicherdauer sind u. a.:\n\nDauer der Mitgliedschaft oder Zusammenarbeit\n\ngesetzliche Aufbewahrungspflichten (z. B. handels- und steuerrechtlich meist 610 Jahre)\n\nBedeutung für die Dokumentation sportlicher Leistungen (z. B. Hall-of-Fame-Einträge, historische Ranglisten)\n\nNach Wegfall des Zwecks bzw. Ablauf gesetzlicher Fristen werden die Daten gelöscht oder anonymisiert.\n\n18. Datensicherheit\n\nWir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um deine Daten gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder unbefugten Zugriff zu schützen.\n\nUnsere Webseite verwendet in der Regel SSL-/TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennst du z. B. an https:// und einem Schloss-Symbol im Browser.\n\n19. Deine Rechte als betroffene Person\n\nDir stehen nach der DSGVO insbesondere folgende Rechte zu:\n\nAuskunft (Art. 15 DSGVO)\nDu kannst Auskunft darüber verlangen, ob und welche personenbezogenen Daten wir über dich verarbeiten.\n\nBerichtigung (Art. 16 DSGVO)\nDu kannst die Berichtigung unrichtiger oder Vervollständigung unvollständiger Daten verlangen.\n\nLöschung (Art. 17 DSGVO)\nDu kannst unter bestimmten Voraussetzungen die Löschung deiner Daten verlangen (Recht auf Vergessenwerden).\n\nEinschränkung der Verarbeitung (Art. 18 DSGVO)\nDu kannst in bestimmten Fällen die Einschränkung der Verarbeitung verlangen.\n\nDatenübertragbarkeit (Art. 20 DSGVO)\nDu kannst verlangen, dass wir dir die Daten, die du uns bereitgestellt hast, in einem strukturierten, gängigen und maschinenlesbaren Format übermitteln oder an einen anderen Verantwortlichen übertragen.\n\nWiderspruchsrecht (Art. 21 DSGVO)\nDu hast das Recht, aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit gegen die Verarbeitung deiner personenbezogenen Daten, die wir auf Grundlage von Art. 6 Abs. 1 lit. e oder f DSGVO vornehmen, Widerspruch einzulegen.\nWir verarbeiten die personenbezogenen Daten dann nicht mehr, es sei denn, es liegen zwingende schutzwürdige Gründe vor oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.\n\nWiderruf von Einwilligungen (Art. 7 Abs. 3 DSGVO)\nEine einmal erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.\n\nBeschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO)\nDu hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren, wenn du der Ansicht bist, dass die Verarbeitung der dich betreffenden Daten gegen Datenschutzrecht verstößt.\n\n20. Pflicht zur Bereitstellung von Daten\n\nIn manchen Fällen ist die Bereitstellung personenbezogener Daten erforderlich, z. B. zur:\n\nAnmeldung zu Turnieren, Seminaren oder Veranstaltungen\n\nBearbeitung eines Mitgliedsantrags\n\nErfüllung vertraglicher oder gesetzlicher Pflichten\n\nWenn du die erforderlichen Daten nicht bereitstellst, kann es sein, dass wir die gewünschte Leistung (z. B. Teilnahme an einem Turnier, Mitgliedschaft, Nutzung des Login-Bereichs) nicht erbringen können.\n\n21. Änderungen dieser Datenschutzerklärung\n\nWir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder Änderungen unserer Leistungen (z. B. Einführung neuer Dienste) widerspiegelt.\n\nFür deinen erneuten Besuch gilt dann die jeweils aktuelle Version der Datenschutzerklärung.\n\nStand: 11.12.2025\n',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(9,3,'hausordnung','1.0','Dojo Regeln (Dojokun)','Hausordnung der Kampfsportschule Schreiner  International\n\nDie nachfolgenden Regeln dienen der Sicherheit, Sauberkeit, Fairness und einem respektvollen Miteinander im gesamten Trainings- und Veranstaltungsbetrieb der Kampfsportschule Schreiner  International (im Folgenden TDA Intl).\n\nMit dem Betreten der Trainingsräume, Hallen oder Veranstaltungsorte erkennt jeder Teilnehmer, Besucher, Schüler, Trainer und Angehörige diese Hausordnung an.\n\n1. Allgemeines Verhalten\n\nRespekt, Höflichkeit und ein freundlicher Umgangston sind verpflichtend.\n\nAnweisungen des Trainers, der Aufsichtspersonen und des Veranstalters sind unbedingt zu befolgen.\n\nJede Form von Gewalt, Diskriminierung, Mobbing, Provokation oder respektlosem Verhalten wird nicht toleriert.\n\nBesucher und Teilnehmer haben sich so zu verhalten, dass niemand gefährdet, gestört oder beeinträchtigt wird.\n\nAlkohol, Drogen und andere berauschende Mittel sind auf dem Gelände verboten. Personen unter Einfluss solcher Substanzen werden vom Training ausgeschlossen.\n\n2. Sauberkeit & Ordnung\n\nDie Trainingsräume sind sauber zu halten.\n\nSchuhe sind nur in den dafür vorgesehenen Bereichen erlaubt  auf der Matte herrscht Barfußpflicht (Ausnahmen: medizinische Gründe, spezielle Matten-Schuhe).\n\nTaschen, Kleidung und persönliche Gegenstände sind ordnungsgemäß abzulegen und keine Stolpergefahr zu verursachen.\n\nJeder ist für die Sauberkeit seines Platzes und seiner Ausrüstung selbst verantwortlich.\n\nMüll bitte in die vorgesehenen Behälter werfen.\n\n3. Kleidung & Ausrüstung\n\nEs ist ordnungsgemäße Trainingskleidung zu tragen (z. B. Gi, Hose, Verbandskleidung, Schul-T-Shirt).\n\nDie Kleidung muss sauber, intakt und geruchsneutral sein.\n\nSchutzausrüstung (z. B. Handschuhe, Mundschutz, Tiefschutz, Schienbeinschoner) ist bei bestimmten Trainingseinheiten verpflichtend.\n\nSchmuck (Ringe, Ketten, Ohrringe, Piercings etc.) ist aus Sicherheitsgründen abzulegen oder abzukleben.\n\nLängere Haare müssen zusammengebunden sein.\n\n4. Sicherheit & Gesundheit\n\nTraining erfolgt stets auf eigene Gefahr; jeder achtet auf die eigenen körperlichen Grenzen.\n\nVerletzungen oder gesundheitliche Probleme müssen dem Trainer sofort gemeldet werden.\n\nDas Trainieren mit ansteckenden Krankheiten, offenen Wunden oder Fieber ist nicht erlaubt.\n\nGefährliche Techniken dürfen nur unter Aufsicht eines Trainers ausgeführt werden.\n\nWildes, unkontrolliertes oder aggressives Verhalten führt zum sofortigen Ausschluss aus dem Training.\n\n5. Matten- und Trainingsregeln\n\nDie Matte darf nur mit sauber gewaschenen Füßen betreten werden.\n\nEssen, Trinken (außer Wasser) und Kaugummi sind auf der Matte verboten.\n\nDas Verlassen der Matte während des Trainings muss beim Trainer angezeigt werden.\n\nSparring findet nur mit Erlaubnis des Trainers statt und unter Beachtung der festgelegten Regeln.\n\nEin fairer, verantwortungsvoller Umgang mit Trainingspartnern ist Pflicht.\n\n6. Verhalten gegenüber Trainern & Schülern\n\nDer Trainer ist während der Trainingseinheit weisungsbefugt.\n\nKritik oder Hinweise sind respektvoll und ausschließlich sachlich zu äußern.\n\nSchüler unterstützen und respektieren sich gegenseitig  unabhängig von Stil, Gürtelgrad, Herkunft, Geschlecht oder körperlicher Verfassung.\n\nDie höhere Graduierung verpflichtet zu Vorbildverhalten.\n\n7. Minderjährige Teilnehmer\n\nEltern oder Erziehungsberechtigte tragen die Verantwortung für die Aufsicht ihrer Kinder außerhalb des Trainings.\n\nKinder dürfen die Matten, Geräte und Räumlichkeiten nicht unbeaufsichtigt nutzen.\n\nUnnötiges Herumrennen im Dojo oder Wartebereich ist zu vermeiden.\n\nEltern dürfen das Training beobachten, aber die Einheit nicht stören.\n\n8. Geräte & Einrichtung\n\nTrainingsgeräte dürfen nur sachgerecht und vorsichtig benutzt werden.\n\nBeschädigungen sind sofort zu melden.\n\nMutwillige Beschädigungen führen zu Schadensersatzforderungen.\n\nGeräte müssen nach Benutzung an ihren Platz zurückgelegt werden.\n\n9. Garderobe & Wertsachen\n\nFür verloren gegangene oder gestohlene Gegenstände übernimmt TDA Intl keine Haftung.\n\nWertsachen sind selbst zu sichern oder nicht mitzuführen.\n\nDer Umkleidebereich ist sauber zu halten.\n\n10. Fotos, Videos & Öffentlichkeitsarbeit\n\nDas Filmen oder Fotografieren im Dojo ist nur mit Erlaubnis des Trainers oder Verbandes erlaubt.\n\nBei offiziellen Veranstaltungen dürfen von TDA Intl Fotos und Videos für Öffentlichkeitsarbeit erstellt werden.\n\nTeilnehmer können der Verwendung widersprechen, sofern keine berechtigten Interessen entgegenstehen.\n\n11. Teilnahmeausschluss & Sanktionen\n\nBei Verstößen gegen diese Hausordnung kann TDA Intl folgende Maßnahmen ergreifen:\n\nmündliche Verwarnung\n\nschriftliche Verwarnung\n\nAusschluss aus der Trainingseinheit\n\ntemporärer Trainingsverweis\n\nHausverbot\n\nfristlose Beendigung der Mitgliedschaft\n\nEin Anspruch auf Rückerstattung der Beiträge besteht nicht.\n\n12. Notfälle\n\nNotausgänge dürfen nicht blockiert werden.\n\nIm Notfall ist den Anweisungen des Personals Folge zu leisten.\n\nErste-Hilfe-Material ist nur im Ernstfall zu verwenden.\n\n13. Gültigkeit\n\nDiese Hausordnung gilt für:\n\nalle Trainingsräume und Hallen\n\nOutdoor-Trainingsbereiche\n\nWettkampf- und Eventorte\n\nSeminarräume\n\nVeranstaltungen, Turniere und Prüfungen\n\nalle Teilnehmer, Besucher und Mitglieder der Kampfsportschule Schreiner  International\n\nMit dem Betreten der Räumlichkeiten bzw. Teilnahme an Aktivitäten wird die Hausordnung anerkannt.\n',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(10,3,'haftung','1.0','Haftungsausschluss','Haftungsausschluss der Kampfsportschule Schreiner  International\n1. Allgemeines\n\nDie Teilnahme an sämtlichen Angeboten, Leistungen und Aktivitäten der Kampfsportschule Schreiner  International (im Folgenden TDA Intl) erfolgt grundsätzlich auf eigene Gefahr.\nDies umfasst insbesondere:\n\nTurniere und Wettkämpfe\n\nTrainings, Kurse, Workshops, Lehrgänge und Seminare\n\nHall-of-Fame-Veranstaltungen und Ehrungen\n\nPrüfungen, Graduierungen und Sparrings\n\nTrainingscamps und Outdoor-Aktivitäten\n\nVereins- und Verbandsveranstaltungen aller Art\n\nMitgliedschaften und Instructor-Programme\n\nFoto-, Video- und Medienaufnahmen\n\nsonstige sportliche oder gemeinschaftliche Veranstaltungen\n\nMit der Teilnahme erkennt jeder Teilnehmer, Erziehungsberechtigter oder Vertreter diesen Haftungsausschluss vollständig an.\n\n2. Gesundheitliche Voraussetzungen und Eigenverantwortung\n\nJeder Teilnehmer bestätigt, dass er:\n\nkörperlich und geistig in der Lage ist, an der jeweiligen Aktivität teilzunehmen,\n\nkeine gesundheitlichen Einschränkungen verheimlicht, die die Teilnahme riskant machen könnten (z. B. Herz-/Kreislaufprobleme, Asthma, Verletzungen, Operationen, Medikamente),\n\nin ausreichender körperlicher Verfassung für Kampfkunst/Kampfsport ist,\n\nselbstständig für angemessene Sportkleidung, Schutzausrüstung und gesundheitliche Vorsorge sorgt.\n\nDie Teilnahme setzt voraus, dass der Teilnehmer sein Training auf eigene Verantwortung gestaltet und auf Warnsignale seines Körpers achtet.\nIm Zweifel ist die Teilnahme zu unterlassen und medizinischer Rat einzuholen.\n\n3. Risiken bei Kampfkunst, Kampfsport & sportlichen Aktivitäten\n\nKampfkunst, Kampfsport und sportliche Bewegungsformen sind mit natürlichen Verletzungsrisiken verbunden, einschließlich, aber nicht beschränkt auf:\n\nPrellungen, Zerrungen, Verstauchungen\n\nVerletzungen der Bänder, Muskeln und Gelenke\n\nKnochenbrüche\n\nKopfverletzungen, Bewusstlosigkeit, Gehirnerschütterungen\n\nAtemnot, Kreislaufprobleme\n\nVerletzungen durch Dritte oder Trainingspartner\n\nSchäden an persönlichem Eigentum\n\nJeder Teilnehmer erklärt ausdrücklich, dass er sich dieser Risiken bewusst ist und sie eigenverantwortlich in Kauf nimmt.\n\n4. Haftung der TDA Intl\n\nDie Kampfsportschule Schreiner  International haftet nur im Rahmen der gesetzlichen Bestimmungen und ausschließlich bei:\n\nvorsätzlichem oder grob fahrlässigem Verhalten\n\nVerletzung von Leben, Körper oder Gesundheit, die auf fahrlässiger oder vorsätzlicher Pflichtverletzung beruhen\n\nzwingenden gesetzlichen Haftungsvorschriften (z. B. Produkthaftungsgesetz)\n\nIn allen anderen Fällen ist eine Haftung ausgeschlossen, insbesondere für:\n\neinfache Fahrlässigkeit\n\nVerletzungen, die durch sporttypische Risiken entstehen\n\nHandlungen Dritter (Teilnehmer, Zuschauer, Vereine, Trainer, Schiedsrichter)\n\nSchäden durch fehlende oder mangelhafte Angabe gesundheitlicher Einschränkungen\n\nselbstverschuldete Unfälle\n\nVerlust oder Beschädigung von Wertgegenständen, Kleidung oder Ausrüstung\n\nSchäden aufgrund höherer Gewalt (z. B. Wetter, Stromausfälle, technische Störungen)\n\n5. Haftungsausschluss für Turniere & Wettkämpfe\n\nBei Turnieren und Wettkämpfen bestätigt jeder Teilnehmer bzw. dessen Erziehungsberechtigter:\n\nDie Teilnahme erfolgt freiwillig und auf eigenes Risiko.\n\nDie Regeln, Sicherheitsvorschriften und Anweisungen der Offiziellen werden beachtet.\n\nDer Veranstalter übernimmt keine Haftung für Schäden, die durch Gegner, internes oder externes Fehlverhalten, Regelverstöße oder unvorhersehbare Kampfverläufe entstehen.\n\nDer Teilnehmer trägt selbst die Verantwortung für die vorgeschriebene Schutzausrüstung.\n\nEine gültige Krankenversicherung ist Voraussetzung.\n\nDie TDA Intl haftet nicht für Unfälle oder Verletzungen, die trotz eines regelkonformen Ablaufs auftreten.\n\n6. Haftungsausschluss für Seminare, Workshops & Training\n\nBei Trainings, Seminaren, Camps und Lehrgängen gilt:\n\nÜbungen können physische und psychische Belastungen mit sich bringen.\n\nJeder hat eigenverantwortlich zu prüfen, ob er die Übung sicher ausführen kann.\n\nDer Trainer stellt lediglich Anleitungen bereit  eine fehlerfreie Ausführung kann nicht garantiert werden.\n\nDer Teilnehmer trägt die Verantwortung, auf eigene Grenzen zu achten.\n\nFür Schäden durch unsachgemäße Selbstüberschätzung wird keine Haftung übernommen.\n\n7. Minderjährige Teilnehmer\n\nErziehungsberechtigte erkennen an:\n\ndass sie die Aufsichtspflicht gegenüber ihren Kindern selbst tragen, soweit diese nicht durch einen Trainer oder Betreuer übernommen wird,\n\ndass sie für Schäden haften, die ihre Kinder anderen zufügen,\n\ndass sie Risiken des Kampfsports kennen und akzeptieren,\n\ndass sie gesundheitliche Einschränkungen ihres Kindes dem Veranstalter mitteilen.\n\n8. Haftung für Ausrüstung & Eigentum\n\nDie TDA Intl übernimmt keine Verantwortung für:\n\nVerlust oder Diebstahl von Kleidung, Equipment oder Wertgegenständen\n\nBeschädigungen durch Fahrlässigkeit anderer Teilnehmer\n\nselbst mitgebrachte Trainingsgeräte oder Hilfsmittel\n\nJeder ist selbst für seine Gegenstände verantwortlich.\n\n9. Foto-, Video- und Medienaufnahmen\n\nBei allen Veranstaltungen kann die TDA Intl Foto- und Videoaufnahmen erstellen bzw. erstellen lassen.\n\nMit der Teilnahme erklärt jeder Teilnehmer bzw. Erziehungsberechtigte:\n\nEr ist einverstanden, dass Aufnahmen im Rahmen der Vereins-/Verbandsarbeit veröffentlicht werden dürfen (Website, Social Media, Turnierberichte, Printmedien usw.).\n\nEin Widerruf ist möglich, jedoch nicht rückwirkend für bereits veröffentlichte Materialien.\n\nBei Portrait- oder individuellen Aufnahmen kann eine gesonderte Einwilligung erforderlich sein.\n\n10. Verhalten, Regelverstöße & Ausschluss von der Teilnahme\n\nDie TDA Intl behält sich das Recht vor, Teilnehmer ohne Anspruch auf Rückerstattung auszuschließen, wenn:\n\nSicherheitsanweisungen missachtet werden,\n\ngesundheitliche Risiken verschwiegen wurden,\n\naggressives, gefährliches oder respektloses Verhalten gezeigt wird,\n\neine Gefährdung anderer Personen besteht.\n\n11. Höhere Gewalt & Veranstaltungsänderungen\n\nFür Ausfälle, Änderungen oder Abbruch einer Veranstaltung aufgrund von Ereignissen außerhalb unserer Kontrolle (z. B. Wetter, Krankheit des Trainers, technische Störungen, Pandemien) wird keine Haftung übernommen.\n\nBereits gezahlte Gebühren können nach Ermessen des Veranstalters erstattet, gutgeschrieben oder als Teilnahmeberechtigung für einen späteren Termin anerkannt werden.\n\n12. Versicherungen\n\nJeder Teilnehmer ist selbst dafür verantwortlich, über ausreichende Kranken-, Unfall- und Haftpflichtversicherung zu verfügen.\n\nDer Veranstalter übernimmt nicht die Kosten für Verletzungen oder Krankenhausaufenthalte, sofern dies nicht gesetzlich vorgeschrieben ist.\n\n13. Salvatorische Klausel\n\nSollten einzelne Bestimmungen dieses Haftungsausschlusses unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.\nAn die Stelle der unwirksamen Klausel tritt eine Regelung, die dem wirtschaftlichen Zweck am nächsten kommt.\n\n14. Anerkennung des Haftungsausschlusses\n\nMit der Teilnahme an jeglichen Aktivitäten, Veranstaltungen oder Programmen der Kampfsportschule Schreiner  International erkennt der Teilnehmer bzw. dessen Erziehungsberechtigter diesen Haftungsausschluss vollständig und verbindlich an.\n',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(11,3,'widerruf','1.0','Widerrufsbelehrung','Widerrufsbelehrung mit Hinweis auf sofortigen Trainingsbeginn\n\nWiderrufsrecht\n\nDu hast das Recht, deine Mitgliedschaft innerhalb von 14 Tagen ohne Angabe von Gründen zu widerrufen.\n\nDie Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.\n\nUm dein Widerrufsrecht auszuüben, musst du uns (Kampfsportschule Schreiner  International, Ohmstr. 14, 84137 Vilsbiburg, info@tda-vib.de\n) mittels einer eindeutigen Erklärung (z. B. E-Mail oder Brief) über deinen Entschluss informieren, die Mitgliedschaft zu widerrufen.\n\nAusnahme: Verzicht auf das Widerrufsrecht bei sofortigem Trainingsbeginn\n\nWenn du ausdrücklich verlangst, dass die Mitgliedschaft bereits vor Ablauf der Widerrufsfrist beginnt und du sofort am Training teilnehmen möchtest, gilt Folgendes:\n\nDu bestätigst mit deinem Antrag ausdrücklich, dass du vor Ablauf der Widerrufsfrist sofort mit dem Training beginnen möchtest.\n\nDu bestätigst außerdem, dass dir bewusst ist, dass du bei vollständiger Vertragserfüllung durch uns dein Widerrufsrecht verlierst.\n\nFür Leistungen, die wir bis zum Zeitpunkt des Widerrufs bereits erbracht haben, musst du ggf. einen angemessenen anteiligen Betrag zahlen.\n\nBeispiel:\nWenn du nach Vertragsabschluss sofort trainierst und erst später innerhalb der Frist widerrufst, wird nur die bereits in Anspruch genommene Zeit berechnet.\n\nDiese Erklärung ist erforderlich, weil du sonst laut Gesetz erst nach Ablauf der 14 Tage trainieren dürftest.\n\nFolgen des Widerrufs\n\nWenn du die Mitgliedschaft innerhalb der Widerrufsfrist widerrufst, erstatten wir dir alle Zahlungen, abzüglich der anteiligen Kosten für bereits genutzte Leistungen, innerhalb von 14 Tagen ab Eingang deines Widerrufs.\n\nMuster-Widerrufsformular\n\n(Wenn du den Vertrag widerrufen möchtest, fülle folgendes Formular aus und sende es zurück.)\n\nAn:\nKampfsportschule Schreiner  International\nOhmstr. 14\n84137 Vilsbiburg\nE-Mail: info@tda-vib.de\n\nHiermit widerrufe ich die von mir abgeschlossene Mitgliedschaft.\n\nName: _______________________________________\n\nAnschrift: __________________________________\n\nDatum des Vertragsabschlusses: _______________\n\nDatum des Widerrufs: ________________________\n\nUnterschrift (bei Mitteilung auf Papier): ___________________________\n',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(12,3,'sonstiges','1.0','Impressum','Impressum\n\nAngaben gemäß § 5 TMG / § 55 RStV\n\nKampfsportschule Schreiner\nInhaber / Verantwortlicher: Stephanie Schreiner\nOhmstr. 14\n84137 Vilsbiburg\nDeutschland\n\nKontakt:\nTelefon: 01575 2461776\nE-Mail: info@tda-vib.de\n\nWebseite: www.tda-vib.de\n\nVertretungsberechtigt\n\nStephanie Schreiner\n(Inhaber, Verbandrepräsentant)\n\nUmsatzsteuer / Steuernummer\n\n\n\nInhaltlich Verantwortlicher gemäß § 55 Abs. 2 RStV\n\nStephanie Schreiner\nOhmstr. 14\n84137 Vilsbiburg\n\nHaftung für Inhalte\n\nAls Dienstanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.\nNach §§ 8?10 TMG sind wir jedoch nicht verpflichtet,\n\nübermittelte oder gespeicherte fremde Informationen zu überwachen oder\n\nnach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.\n\nVerpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.\nEine Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich.\nBei Bekanntwerden entsprechender Rechtsverletzungen entfernen wir diese Inhalte umgehend.\n\nHaftung für Links\n\nUnser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.\nDeshalb können wir für diese fremden Inhalte keine Gewähr übernehmen.\n\nFür die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.\nBei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links sofort.\n\nUrheberrecht\n\nDie auf dieser Website veröffentlichten Inhalte, Bilder, Texte, Grafiken, Logos und Designs unterliegen dem deutschen Urheberrecht.\nVervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Rechteinhabers.\n\nDownloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.\n\nMarken- und Schutzrechte\n\n?Kampfsportschule Schreiner? sowie sämtliche Logos, Abzeichen und Titel können geschützte Marken oder eingetragene Kennzeichen sein.\nJede unbefugte Nutzung ist untersagt.\n\nOnline-Streitbeilegung\n\nDie Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:\nhttps://ec.europa.eu/consumers/odr\n\nWir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.\n\nGender-Hinweis\n\nAus Gründen der Lesbarkeit wird in Texten auf dieser Seite überwiegend die männliche Form gewählt.\nAlle personenbezogenen Bezeichnungen gelten gleichermaßen für alle Geschlechter.\n\n',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 20:08:23','2025-12-20 20:08:23'),(17,2,'kuendigung','1.0','KÃ¼ndigungsschreiben Mitgliedschaft','<div style=\"font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;\">\n    <div style=\"text-align: right; margin-bottom: 30px;\">\n        <div>{{absender_name}}</div>\n        <div>{{absender_strasse}} {{absender_hausnummer}}</div>\n        <div>{{absender_plz}} {{absender_ort}}</div>\n        <div style=\"margin-top: 20px;\">{{datum}}</div>\n    </div>\n    \n    <div style=\"margin-bottom: 30px;\">\n        <div><strong>Tiger & Dragon Association - International</strong></div>\n        <div>Sascha Schreiner</div>\n        <div>Naunhofer Str. 23</div>\n        <div>04299 Leipzig</div>\n    </div>\n    \n    <div style=\"margin-bottom: 20px;\">\n        <strong>K&uuml;ndigung der Mitgliedschaft</strong>\n    </div>\n    \n    <div style=\"margin-bottom: 15px;\">\n        Sehr geehrte Damen und Herren,\n    </div>\n    \n    <div style=\"margin-bottom: 20px; text-align: justify;\">\n        hiermit k&uuml;ndige ich meine Mitgliedschaft in Ihrer Einrichtung <strong>fristgerecht zum {{kuendigungsdatum}}</strong>.\n    </div>\n    \n    <div style=\"margin-bottom: 20px; text-align: justify;\">\n        Ich bitte um eine schriftliche Best&auml;tigung der K&uuml;ndigung sowie um die Angabe des Beendigungszeitpunktes.\n    </div>\n    \n    <div style=\"margin-bottom: 40px; text-align: justify;\">\n        Vielen Dank f&uuml;r die bisherige Zusammenarbeit.\n    </div>\n    \n    <div style=\"margin-bottom: 10px;\">\n        Mit freundlichen Gr&uuml;&szlig;en\n    </div>\n    \n    <div style=\"margin-top: 60px;\">\n        <div>___________________________</div>\n        <div>{{vorname}} {{nachname}}</div>\n    </div>\n</div>',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 22:14:07','2025-12-20 22:15:40'),(18,3,'kuendigung','1.0','KÃ¼ndigungsschreiben Mitgliedschaft','<div style=\"font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;\">\n    <div style=\"text-align: right; margin-bottom: 30px;\">\n        <div>{{absender_name}}</div>\n        <div>{{absender_strasse}} {{absender_hausnummer}}</div>\n        <div>{{absender_plz}} {{absender_ort}}</div>\n        <div style=\"margin-top: 20px;\">{{datum}}</div>\n    </div>\n    \n    <div style=\"margin-bottom: 30px;\">\n        <div><strong>Kampfsportschule Schreiner</strong></div>\n        <div>Stephanie Schreiner</div>\n        <div>Naunhofer Str. 23</div>\n        <div>04299 Leipzig</div>\n    </div>\n    \n    <div style=\"margin-bottom: 20px;\">\n        <strong>K&uuml;ndigung der Mitgliedschaft</strong>\n    </div>\n    \n    <div style=\"margin-bottom: 15px;\">\n        Sehr geehrte Damen und Herren,\n    </div>\n    \n    <div style=\"margin-bottom: 20px; text-align: justify;\">\n        hiermit k&uuml;ndige ich meine Mitgliedschaft in Ihrer Einrichtung <strong>fristgerecht zum {{kuendigungsdatum}}</strong>.\n    </div>\n    \n    <div style=\"margin-bottom: 20px; text-align: justify;\">\n        Ich bitte um eine schriftliche Best&auml;tigung der K&uuml;ndigung sowie um die Angabe des Beendigungszeitpunktes.\n    </div>\n    \n    <div style=\"margin-bottom: 40px; text-align: justify;\">\n        Vielen Dank f&uuml;r die bisherige Zusammenarbeit.\n    </div>\n    \n    <div style=\"margin-bottom: 10px;\">\n        Mit freundlichen Gr&uuml;&szlig;en\n    </div>\n    \n    <div style=\"margin-top: 60px;\">\n        <div>___________________________</div>\n        <div>{{vorname}} {{nachname}}</div>\n    </div>\n</div>',NULL,'2025-12-20',NULL,1,NULL,'2025-12-20 22:14:07','2025-12-20 22:15:40');
/*!40000 ALTER TABLE `vertragsdokumente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vertragshistorie`
--

DROP TABLE IF EXISTS `vertragshistorie`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vertragshistorie` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vertrag_id` int NOT NULL COMMENT 'Zugehöriger Vertrag',
  `aenderung_typ` enum('erstellt','geaendert','gekuendigt','pausiert','reaktiviert','beendet') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Art der Änderung',
  `aenderung_beschreibung` text COLLATE utf8mb4_unicode_ci COMMENT 'Beschreibung der Änderung',
  `aenderung_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'Detaillierte Änderungen (vorher/nachher)',
  `geaendert_von` int DEFAULT NULL COMMENT 'Benutzer der die Änderung vorgenommen hat',
  `geaendert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Zeitpunkt der Änderung',
  `ip_adresse` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP-Adresse (falls relevant)',
  PRIMARY KEY (`id`),
  KEY `idx_vertrag_datum` (`vertrag_id`,`geaendert_am`),
  CONSTRAINT `vertragshistorie_ibfk_1` FOREIGN KEY (`vertrag_id`) REFERENCES `vertraege` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vertragshistorie_chk_1` CHECK (json_valid(`aenderung_details`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Protokolliert alle Änderungen an Verträgen für Revisionssicherheit';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertragshistorie`
--

LOCK TABLES `vertragshistorie` WRITE;
/*!40000 ALTER TABLE `vertragshistorie` DISABLE KEYS */;
/*!40000 ALTER TABLE `vertragshistorie` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vertragsleistungen`
--

DROP TABLE IF EXISTS `vertragsleistungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vertragsleistungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vertrag_id` int NOT NULL COMMENT 'Zugehöriger Vertrag',
  `beschreibung` text COLLATE utf8mb4_unicode_ci COMMENT 'Beschreibung der Leistungen',
  `anzahl_einheiten_pro_woche` int DEFAULT '2' COMMENT 'Anzahl Trainingseinheiten pro Woche',
  `standorte` text COLLATE utf8mb4_unicode_ci COMMENT 'Welche Dojos/Standorte nutzbar (JSON Array)',
  `inkludierte_kurse` text COLLATE utf8mb4_unicode_ci COMMENT 'Welche Kurse sind enthalten (JSON Array)',
  `zusatzleistungen` text COLLATE utf8mb4_unicode_ci COMMENT 'Was ist zusätzlich enthalten (Events, Prüfungen, etc.)',
  `ausschluesse` text COLLATE utf8mb4_unicode_ci COMMENT 'Was ist NICHT enthalten',
  `urlaubstage_pro_jahr` int DEFAULT '0' COMMENT 'Anzahl Tage Urlaubspause pro Jahr',
  `urlaubsregelung` text COLLATE utf8mb4_unicode_ci COMMENT 'Beschreibung der Urlaubsregelung',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vertrag_id` (`vertrag_id`),
  CONSTRAINT `vertragsleistungen_ibfk_1` FOREIGN KEY (`vertrag_id`) REFERENCES `vertraege` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Definiert den Leistungsumfang eines Vertrags';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertragsleistungen`
--

LOCK TABLES `vertragsleistungen` WRITE;
/*!40000 ALTER TABLE `vertragsleistungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `vertragsleistungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vertragsvorlagen`
--

DROP TABLE IF EXISTS `vertragsvorlagen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vertragsvorlagen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `grapesjs_html` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `grapesjs_css` longtext COLLATE utf8mb4_unicode_ci,
  `grapesjs_components` longtext COLLATE utf8mb4_unicode_ci,
  `grapesjs_styles` longtext COLLATE utf8mb4_unicode_ci,
  `template_type` enum('vertrag','sepa','agb','datenschutz','custom') COLLATE utf8mb4_unicode_ci DEFAULT 'vertrag',
  `is_default` tinyint(1) DEFAULT '0',
  `aktiv` tinyint(1) DEFAULT '1',
  `available_placeholders` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `version` int DEFAULT '1',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `erstellt_von` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `dojo_id` (`dojo_id`),
  CONSTRAINT `vertragsvorlagen_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vertragsvorlagen_chk_1` CHECK (json_valid(`available_placeholders`))
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertragsvorlagen`
--

LOCK TABLES `vertragsvorlagen` WRITE;
/*!40000 ALTER TABLE `vertragsvorlagen` DISABLE KEYS */;
INSERT INTO `vertragsvorlagen` VALUES (4,2,'Mitgliedsvertrag - TDA Style','','<body><!-- SEITE 1: MITGLIEDSVERTRAG --><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/><title>Mitgliedsvertrag</title><div class=\"page\"><div class=\"header\"><div class=\"header-left\"><h1>MITGLIEDSVERTRAG</h1><h2>{{dojo_name}}</h2></div><div class=\"logo-placeholder\">\n                LOGO\n            </div></div><div class=\"section-title\">PERSÖNLICHE DATEN</div><div class=\"data-grid\"><div class=\"data-field\"><label>Mitgliedsnummer</label><div class=\"value\">{{mitglied_id}}</div></div><div class=\"data-field\"><label>Anrede</label><div class=\"value\">{{anrede}}</div></div><div class=\"data-field\"><label>Vorname</label><div class=\"value\">{{vorname}}</div></div><div class=\"data-field\"><label>Nachname</label><div class=\"value\">{{nachname}}</div></div></div><div class=\"address-grid\"><div class=\"data-field\"><label>Straße</label><div class=\"value\">{{strasse}}</div></div><div class=\"data-field\"><label>Hausnummer</label><div class=\"value\">{{hausnummer}}</div></div><div class=\"data-field\"><label>PLZ</label><div class=\"value\">{{plz}}</div></div><div class=\"data-field\"><label>Ort</label><div class=\"value\">{{ort}}</div></div></div><div class=\"data-grid\"><div class=\"data-field\"><label>Telefonnummer</label><div class=\"value\">{{telefon}}</div></div><div class=\"data-field\"><label>E-Mail-Adresse</label><div class=\"value\">{{email}}</div></div><div class=\"data-field\"><label>Mobil</label><div class=\"value\">{{mobil}}</div></div><div class=\"data-field\"><label>Geburtsdatum</label><div class=\"value\">{{geburtsdatum}}</div></div></div><div class=\"section-title\">VERTRAGSDATEN</div><p class=\"intro-text\">Ich habe mich für den nachfolgenden Tarif entschieden:</p><div class=\"contract-grid\"><div class=\"data-field\"><label>Tarifname</label><div class=\"value\">{{tarif_name}}</div></div><div class=\"data-field\"><label>Höhe Betrag</label><div class=\"value\">{{betrag}} €</div></div><div class=\"data-field\"><label>Aufnahmegebühr</label><div class=\"value\">{{aufnahmegebuehr}} €</div></div><div class=\"data-field\"><label>Mindestlaufzeit</label><div class=\"value\">{{mindestlaufzeit}}</div></div><div class=\"data-field\"><label>Vertragsbeginn</label><div class=\"value\">{{vertragsbeginn}}</div></div><div class=\"data-field\"><label>Nutzungsbeginn</label><div class=\"value\">{{nutzungsbeginn}}</div></div><div class=\"data-field\"><label>Vertragsverlängerungsdauer</label><div class=\"value\">{{vertragsverlaengerung}}</div></div><div class=\"data-field\"><label>Kündigungsfrist</label><div class=\"value\">{{kuendigungsfrist}}</div></div><div class=\"data-field\"><label>Zahlweise</label><div class=\"value\">{{zahlweise}}</div></div></div><div class=\"total-box\">\n            Gesamt (inkl. Pauschalen und Zusatzmodule)<br/>\n            {{betrag}} € {{zahlweise}}\n        </div><p class=\"legal-text\">\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.<br/>\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\n        </p><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"ivgjfp\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Vertragsnehmer\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 2: SEPA-LASTSCHRIFTMANDAT --><div class=\"page\"><div class=\"section-title\">SEPA-LASTSCHRIFTMANDAT</div><p class=\"legal-text\">\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.<br/><br/>\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\n        </p><div class=\"data-grid\"><div class=\"data-field data-field-wide\"><label>Vorname und Name (Kontoinhaber)</label><div class=\"value\">{{kontoinhaber}}</div></div><div class=\"data-field\"><label>Kreditinstitut (Name)</label><div class=\"value\">{{kreditinstitut}}</div></div><div class=\"data-field\"><label>BIC</label><div class=\"value\">{{bic}}</div></div><div class=\"data-field data-field-wide\"><label>IBAN</label><div class=\"value\">{{iban}}</div></div><div class=\"data-field data-field-wide\"><label>SEPA Mandatsreferenz-Nummer</label><div class=\"value\">{{sepa_referenz}}</div></div></div><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"itf9vg\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Kontoinhaber\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 3: ZAHLUNGSTERMINE --><div class=\"page\"><div class=\"section-title\">ZAHLUNGSTERMINE</div>\n\n        \n                {{zahlungstermine}}\n            <table><thead><tr><th>Fälligkeitsdatum</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th></tr></thead><tbody><tr class=\"row\"><td class=\"cell\"></td></tr></tbody></table><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div></body>','* { box-sizing: border-box; } body {margin: 0;}body{font-family:Arial, sans-serif;font-size:11pt;line-height:1.4;color:rgb(51, 51, 51);margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;padding-top:20px;padding-right:20px;padding-bottom:20px;padding-left:20px;}.page{width:210mm;min-height:297mm;padding-top:20mm;padding-right:20mm;padding-bottom:20mm;padding-left:20mm;margin-top:0px;margin-right:auto;margin-bottom:0px;margin-left:auto;background-image:initial;background-position-x:initial;background-position-y:initial;background-size:initial;background-repeat:initial;background-attachment:initial;background-origin:initial;background-clip:initial;background-color:white;break-after:page;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}.header-left h1{font-size:24pt;font-weight:bold;margin-top:0px;margin-right:0px;margin-bottom:5px;margin-left:0px;color:rgb(51, 51, 51);}.header-left h2{font-size:18pt;font-weight:normal;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;color:rgb(102, 102, 102);}.logo-placeholder{width:120px;height:120px;border-top-width:2px;border-right-width:2px;border-bottom-width:2px;border-left-width:2px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(51, 51, 51);border-right-color:rgb(51, 51, 51);border-bottom-color:rgb(51, 51, 51);border-left-color:rgb(51, 51, 51);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;border-top-left-radius:50%;border-top-right-radius:50%;border-bottom-right-radius:50%;border-bottom-left-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10pt;color:rgb(153, 153, 153);}.section-title{font-size:14pt;font-weight:bold;margin-top:25px;margin-right:0px;margin-bottom:15px;margin-left:0px;text-transform:uppercase;}.data-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.data-field{margin-bottom:10px;}.data-field label{display:block;font-size:9pt;color:rgb(102, 102, 102);margin-bottom:3px;}.data-field .value{background-color:rgb(232, 232, 232);padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-left-radius:3px;border-top-right-radius:3px;border-bottom-right-radius:3px;border-bottom-left-radius:3px;min-height:20px;font-size:11pt;}.data-field-wide{grid-column-start:1;grid-column-end:-1;}.address-grid{display:grid;grid-template-columns:2fr 1fr 1fr 2fr;row-gap:10px;column-gap:10px;}.contract-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.total-box{background-color:rgb(232, 232, 232);padding-top:12px;padding-right:12px;padding-bottom:12px;padding-left:12px;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;font-weight:bold;font-size:12pt;}.legal-text{font-size:10pt;line-height:1.6;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;color:rgb(85, 85, 85);}.signature-section{margin-top:50px;display:flex;justify-content:space-between;}.signature-box{width:45%;}.signature-line{border-top-width:1px;border-top-style:solid;border-top-color:rgb(51, 51, 51);margin-top:60px;padding-top:8px;font-size:9pt;color:rgb(102, 102, 102);}.footer{position:absolute;bottom:15mm;left:20mm;right:20mm;text-align:center;font-size:8pt;color:rgb(102, 102, 102);border-top-width:1px;border-top-style:solid;border-top-color:rgb(204, 204, 204);padding-top:10px;}.footer-line{margin-top:3px;margin-right:0px;margin-bottom:3px;margin-left:0px;}table{width:100%;border-collapse:collapse;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;}table th{background-color:rgb(232, 232, 232);padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;text-align:left;font-size:10pt;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;}table td{padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;font-size:10pt;}.intro-text{font-size:10pt;margin-bottom:15px;}@page{size:a4;margin-top:2cm;margin-right:2cm;margin-bottom:2cm;margin-left:2cm;}@media print{body{padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}.page{margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;border-top-width:initial;border-right-width:initial;border-bottom-width:initial;border-left-width:initial;border-top-style:none;border-right-style:none;border-bottom-style:none;border-left-style:none;border-top-color:initial;border-right-color:initial;border-bottom-color:initial;border-left-color:initial;border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}}','[{\"type\":\"comment\",\"content\":\" SEITE 1: MITGLIEDSVERTRAG \"},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"charset\":\"UTF-8\"}},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"name\":\"viewport\",\"content\":\"width=device-width, initial-scale=1.0\"}},{\"tagName\":\"title\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsvertrag\"}]},{\"classes\":[\"page\"],\"components\":[{\"classes\":[\"header\"],\"components\":[{\"classes\":[\"header-left\"],\"components\":[{\"tagName\":\"h1\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"MITGLIEDSVERTRAG\"}]},{\"tagName\":\"h2\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_name}}\"}]}]},{\"type\":\"text\",\"classes\":[\"logo-placeholder\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                LOGO\\n            \"}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"PERSÖNLICHE DATEN\"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mitglied_id}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Anrede\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{anrede}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vorname}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nachname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nachname}}\"}]}]}]},{\"classes\":[\"address-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Straße\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{strasse}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Hausnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{hausnummer}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"PLZ\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{plz}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Ort\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}\"}]}]}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Telefonnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{telefon}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"E-Mail-Adresse\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{email}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mobil\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mobil}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Geburtsdatum\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{geburtsdatum}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"VERTRAGSDATEN\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"intro-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Ich habe mich für den nachfolgenden Tarif entschieden:\"}]},{\"classes\":[\"contract-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Tarifname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{tarif_name}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Höhe Betrag\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{betrag}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Aufnahmegebühr\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{aufnahmegebuehr}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mindestlaufzeit\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mindestlaufzeit}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nutzungsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nutzungsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsverlängerungsdauer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsverlaengerung}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kündigungsfrist\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kuendigungsfrist}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Zahlweise\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{zahlweise}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"total-box\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Gesamt (inkl. Pauschalen und Zusatzmodule)\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            {{betrag}} € {{zahlweise}}\\n        \"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\\n        \"}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"ivgjfp\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Vertragsnehmer\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 2: SEPA-LASTSCHRIFTMANDAT \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA-LASTSCHRIFTMANDAT\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.\"},{\"tagName\":\"br\",\"void\":true},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\\n        \"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname und Name (Kontoinhaber)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kontoinhaber}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kreditinstitut (Name)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kreditinstitut}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"BIC\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{bic}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"IBAN\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{iban}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA Mandatsreferenz-Nummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{sepa_referenz}}\"}]}]}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"itf9vg\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Kontoinhaber\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 3: ZAHLUNGSTERMINE \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"ZAHLUNGSTERMINE\"}]},{\"type\":\"textnode\",\"content\":\"\\n\\n        \\n                {{zahlungstermine}}\\n            \"},{\"type\":\"table\",\"droppable\":[\"tbody\",\"thead\",\"tfoot\"],\"components\":[{\"type\":\"thead\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"components\":[{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Fälligkeitsdatum\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Typ\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Beschreibung\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Betrag\"}]}]}]},{\"type\":\"tbody\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"classes\":[\"row\"],\"components\":[{\"type\":\"cell\",\"draggable\":[\"tr\"],\"classes\":[\"cell\"]}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]}]','[{\"selectors\":[],\"style\":{\"size\":\"a4\",\"margin-top\":\"2cm\",\"margin-right\":\"2cm\",\"margin-bottom\":\"2cm\",\"margin-left\":\"2cm\"},\"atRuleType\":\"page\",\"singleAtRule\":true},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"font-family\":\"Arial, sans-serif\",\"font-size\":\"11pt\",\"line-height\":\"1.4\",\"color\":\"rgb(51, 51, 51)\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"padding-top\":\"20px\",\"padding-right\":\"20px\",\"padding-bottom\":\"20px\",\"padding-left\":\"20px\"}},{\"selectors\":[\"page\"],\"style\":{\"width\":\"210mm\",\"min-height\":\"297mm\",\"padding-top\":\"20mm\",\"padding-right\":\"20mm\",\"padding-bottom\":\"20mm\",\"padding-left\":\"20mm\",\"margin-top\":\"0px\",\"margin-right\":\"auto\",\"margin-bottom\":\"0px\",\"margin-left\":\"auto\",\"background-image\":\"initial\",\"background-position-x\":\"initial\",\"background-position-y\":\"initial\",\"background-size\":\"initial\",\"background-repeat\":\"initial\",\"background-attachment\":\"initial\",\"background-origin\":\"initial\",\"background-clip\":\"initial\",\"background-color\":\"white\",\"break-after\":\"page\"}},{\"selectors\":[\"header\"],\"style\":{\"display\":\"flex\",\"justify-content\":\"space-between\",\"align-items\":\"flex-start\",\"margin-bottom\":\"30px\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h1\",\"style\":{\"font-size\":\"24pt\",\"font-weight\":\"bold\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"5px\",\"margin-left\":\"0px\",\"color\":\"rgb(51, 51, 51)\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h2\",\"style\":{\"font-size\":\"18pt\",\"font-weight\":\"normal\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"logo-placeholder\"],\"style\":{\"width\":\"120px\",\"height\":\"120px\",\"border-top-width\":\"2px\",\"border-right-width\":\"2px\",\"border-bottom-width\":\"2px\",\"border-left-width\":\"2px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"border-right-color\":\"rgb(51, 51, 51)\",\"border-bottom-color\":\"rgb(51, 51, 51)\",\"border-left-color\":\"rgb(51, 51, 51)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"border-top-left-radius\":\"50%\",\"border-top-right-radius\":\"50%\",\"border-bottom-right-radius\":\"50%\",\"border-bottom-left-radius\":\"50%\",\"display\":\"flex\",\"align-items\":\"center\",\"justify-content\":\"center\",\"font-size\":\"10pt\",\"color\":\"rgb(153, 153, 153)\"}},{\"selectors\":[\"section-title\"],\"style\":{\"font-size\":\"14pt\",\"font-weight\":\"bold\",\"margin-top\":\"25px\",\"margin-right\":\"0px\",\"margin-bottom\":\"15px\",\"margin-left\":\"0px\",\"text-transform\":\"uppercase\"}},{\"selectors\":[\"data-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"data-field\"],\"style\":{\"margin-bottom\":\"10px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field label\",\"style\":{\"display\":\"block\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\",\"margin-bottom\":\"3px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field .value\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-left-radius\":\"3px\",\"border-top-right-radius\":\"3px\",\"border-bottom-right-radius\":\"3px\",\"border-bottom-left-radius\":\"3px\",\"min-height\":\"20px\",\"font-size\":\"11pt\"}},{\"selectors\":[\"data-field-wide\"],\"style\":{\"grid-column-start\":\"1\",\"grid-column-end\":\"-1\"}},{\"selectors\":[\"address-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"2fr 1fr 1fr 2fr\",\"row-gap\":\"10px\",\"column-gap\":\"10px\"}},{\"selectors\":[\"contract-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"total-box\"],\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"12px\",\"padding-right\":\"12px\",\"padding-bottom\":\"12px\",\"padding-left\":\"12px\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"font-weight\":\"bold\",\"font-size\":\"12pt\"}},{\"selectors\":[\"legal-text\"],\"style\":{\"font-size\":\"10pt\",\"line-height\":\"1.6\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"color\":\"rgb(85, 85, 85)\"}},{\"selectors\":[\"signature-section\"],\"style\":{\"margin-top\":\"50px\",\"display\":\"flex\",\"justify-content\":\"space-between\"}},{\"selectors\":[\"signature-box\"],\"style\":{\"width\":\"45%\"}},{\"selectors\":[\"signature-line\"],\"style\":{\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"margin-top\":\"60px\",\"padding-top\":\"8px\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"footer\"],\"style\":{\"position\":\"absolute\",\"bottom\":\"15mm\",\"left\":\"20mm\",\"right\":\"20mm\",\"text-align\":\"center\",\"font-size\":\"8pt\",\"color\":\"rgb(102, 102, 102)\",\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"padding-top\":\"10px\"}},{\"selectors\":[\"footer-line\"],\"style\":{\"margin-top\":\"3px\",\"margin-right\":\"0px\",\"margin-bottom\":\"3px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table\",\"style\":{\"width\":\"100%\",\"border-collapse\":\"collapse\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table th\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"10px\",\"padding-right\":\"10px\",\"padding-bottom\":\"10px\",\"padding-left\":\"10px\",\"text-align\":\"left\",\"font-size\":\"10pt\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\"}},{\"selectors\":[],\"selectorsAdd\":\"table td\",\"style\":{\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"font-size\":\"10pt\"}},{\"selectors\":[\"intro-text\"],\"style\":{\"font-size\":\"10pt\",\"margin-bottom\":\"15px\"}},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"},{\"selectors\":[\"page\"],\"style\":{\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"border-top-width\":\"initial\",\"border-right-width\":\"initial\",\"border-bottom-width\":\"initial\",\"border-left-width\":\"initial\",\"border-top-style\":\"none\",\"border-right-style\":\"none\",\"border-bottom-style\":\"none\",\"border-left-style\":\"none\",\"border-top-color\":\"initial\",\"border-right-color\":\"initial\",\"border-bottom-color\":\"initial\",\"border-left-color\":\"initial\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"}]','vertrag',1,1,NULL,4,'2025-10-26 14:23:52','2025-12-14 19:59:47',NULL),(6,3,'Mitgliedsvertrag - TDA Style (Kopie)','','<body><!-- SEITE 1: MITGLIEDSVERTRAG --><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/><title>Mitgliedsvertrag</title><div class=\"page\"><div class=\"header\"><div class=\"header-left\"><h1>MITGLIEDSVERTRAG</h1><h2>{{dojo_name}}</h2></div><div class=\"logo-placeholder\">\n                LOGO\n            </div></div><div class=\"section-title\">PERSÖNLICHE DATEN</div><div class=\"data-grid\"><div class=\"data-field\"><label>Mitgliedsnummer</label><div class=\"value\">{{mitglied_id}}</div></div><div class=\"data-field\"><label>Anrede</label><div class=\"value\">{{anrede}}</div></div><div class=\"data-field\"><label>Vorname</label><div class=\"value\">{{vorname}}</div></div><div class=\"data-field\"><label>Nachname</label><div class=\"value\">{{nachname}}</div></div></div><div class=\"address-grid\"><div class=\"data-field\"><label>Straße</label><div class=\"value\">{{strasse}}</div></div><div class=\"data-field\"><label>Hausnummer</label><div class=\"value\">{{hausnummer}}</div></div><div class=\"data-field\"><label>PLZ</label><div class=\"value\">{{plz}}</div></div><div class=\"data-field\"><label>Ort</label><div class=\"value\">{{ort}}</div></div></div><div class=\"data-grid\"><div class=\"data-field\"><label>Telefonnummer</label><div class=\"value\">{{telefon}}</div></div><div class=\"data-field\"><label>E-Mail-Adresse</label><div class=\"value\">{{email}}</div></div><div class=\"data-field\"><label>Mobil</label><div class=\"value\">{{mobil}}</div></div><div class=\"data-field\"><label>Geburtsdatum</label><div class=\"value\">{{geburtsdatum}}</div></div></div><div class=\"section-title\">VERTRAGSDATEN</div><p class=\"intro-text\">Ich habe mich für den nachfolgenden Tarif entschieden:</p><div class=\"contract-grid\"><div class=\"data-field\"><label>Tarifname</label><div class=\"value\">{{tarif_name}}</div></div><div class=\"data-field\"><label>Höhe Betrag</label><div class=\"value\">{{betrag}} €</div></div><div class=\"data-field\"><label>Aufnahmegebühr</label><div class=\"value\">{{aufnahmegebuehr}} €</div></div><div class=\"data-field\"><label>Mindestlaufzeit</label><div class=\"value\">{{mindestlaufzeit}}</div></div><div class=\"data-field\"><label>Vertragsbeginn</label><div class=\"value\">{{vertragsbeginn}}</div></div><div class=\"data-field\"><label>Nutzungsbeginn</label><div class=\"value\">{{nutzungsbeginn}}</div></div><div class=\"data-field\"><label>Vertragsverlängerungsdauer</label><div class=\"value\">{{vertragsverlaengerung}}</div></div><div class=\"data-field\"><label>Kündigungsfrist</label><div class=\"value\">{{kuendigungsfrist}}</div></div><div class=\"data-field\"><label>Zahlweise</label><div class=\"value\">{{zahlweise}}</div></div></div><div class=\"total-box\">\n            Gesamt (inkl. Pauschalen und Zusatzmodule)<br/>\n            {{betrag}} € {{zahlweise}}\n        </div><p class=\"legal-text\">\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.<br/>\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\n        </p><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"ivgjfp\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Vertragsnehmer\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 2: SEPA-LASTSCHRIFTMANDAT --><div class=\"page\"><div class=\"section-title\">SEPA-LASTSCHRIFTMANDAT</div><p class=\"legal-text\">\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.<br/><br/>\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\n        </p><div class=\"data-grid\"><div class=\"data-field data-field-wide\"><label>Vorname und Name (Kontoinhaber)</label><div class=\"value\">{{kontoinhaber}}</div></div><div class=\"data-field\"><label>Kreditinstitut (Name)</label><div class=\"value\">{{kreditinstitut}}</div></div><div class=\"data-field\"><label>BIC</label><div class=\"value\">{{bic}}</div></div><div class=\"data-field data-field-wide\"><label>IBAN</label><div class=\"value\">{{iban}}</div></div><div class=\"data-field data-field-wide\"><label>SEPA Mandatsreferenz-Nummer</label><div class=\"value\">{{sepa_referenz}}</div></div></div><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"itf9vg\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Kontoinhaber\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 3: ZAHLUNGSTERMINE --><div class=\"page\"><div class=\"section-title\">ZAHLUNGSTERMINE</div>\n\n        \n                {{zahlungstermine}}\n            <table><thead><tr><th>Fälligkeitsdatum</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th></tr></thead><tbody><tr class=\"row\"><td class=\"cell\"></td></tr></tbody></table><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div></body>','* { box-sizing: border-box; } body {margin: 0;}body{font-family:Arial, sans-serif;font-size:11pt;line-height:1.4;color:rgb(51, 51, 51);margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;padding-top:20px;padding-right:20px;padding-bottom:20px;padding-left:20px;}.page{width:210mm;min-height:297mm;padding-top:20mm;padding-right:20mm;padding-bottom:20mm;padding-left:20mm;margin-top:0px;margin-right:auto;margin-bottom:0px;margin-left:auto;background-image:initial;background-position-x:initial;background-position-y:initial;background-size:initial;background-repeat:initial;background-attachment:initial;background-origin:initial;background-clip:initial;background-color:white;break-after:page;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}.header-left h1{font-size:24pt;font-weight:bold;margin-top:0px;margin-right:0px;margin-bottom:5px;margin-left:0px;color:rgb(51, 51, 51);}.header-left h2{font-size:18pt;font-weight:normal;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;color:rgb(102, 102, 102);}.logo-placeholder{width:120px;height:120px;border-top-width:2px;border-right-width:2px;border-bottom-width:2px;border-left-width:2px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(51, 51, 51);border-right-color:rgb(51, 51, 51);border-bottom-color:rgb(51, 51, 51);border-left-color:rgb(51, 51, 51);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;border-top-left-radius:50%;border-top-right-radius:50%;border-bottom-right-radius:50%;border-bottom-left-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10pt;color:rgb(153, 153, 153);}.section-title{font-size:14pt;font-weight:bold;margin-top:25px;margin-right:0px;margin-bottom:15px;margin-left:0px;text-transform:uppercase;}.data-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.data-field{margin-bottom:10px;}.data-field label{display:block;font-size:9pt;color:rgb(102, 102, 102);margin-bottom:3px;}.data-field .value{background-color:rgb(232, 232, 232);padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-left-radius:3px;border-top-right-radius:3px;border-bottom-right-radius:3px;border-bottom-left-radius:3px;min-height:20px;font-size:11pt;}.data-field-wide{grid-column-start:1;grid-column-end:-1;}.address-grid{display:grid;grid-template-columns:2fr 1fr 1fr 2fr;row-gap:10px;column-gap:10px;}.contract-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.total-box{background-color:rgb(232, 232, 232);padding-top:12px;padding-right:12px;padding-bottom:12px;padding-left:12px;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;font-weight:bold;font-size:12pt;}.legal-text{font-size:10pt;line-height:1.6;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;color:rgb(85, 85, 85);}.signature-section{margin-top:50px;display:flex;justify-content:space-between;}.signature-box{width:45%;}.signature-line{border-top-width:1px;border-top-style:solid;border-top-color:rgb(51, 51, 51);margin-top:60px;padding-top:8px;font-size:9pt;color:rgb(102, 102, 102);}.footer{position:absolute;bottom:15mm;left:20mm;right:20mm;text-align:center;font-size:8pt;color:rgb(102, 102, 102);border-top-width:1px;border-top-style:solid;border-top-color:rgb(204, 204, 204);padding-top:10px;}.footer-line{margin-top:3px;margin-right:0px;margin-bottom:3px;margin-left:0px;}table{width:100%;border-collapse:collapse;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;}table th{background-color:rgb(232, 232, 232);padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;text-align:left;font-size:10pt;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;}table td{padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;font-size:10pt;}.intro-text{font-size:10pt;margin-bottom:15px;}@page{size:a4;margin-top:2cm;margin-right:2cm;margin-bottom:2cm;margin-left:2cm;}@media print{body{padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}.page{margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;border-top-width:initial;border-right-width:initial;border-bottom-width:initial;border-left-width:initial;border-top-style:none;border-right-style:none;border-bottom-style:none;border-left-style:none;border-top-color:initial;border-right-color:initial;border-bottom-color:initial;border-left-color:initial;border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}}','[{\"type\":\"comment\",\"content\":\" SEITE 1: MITGLIEDSVERTRAG \"},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"charset\":\"UTF-8\"}},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"name\":\"viewport\",\"content\":\"width=device-width, initial-scale=1.0\"}},{\"tagName\":\"title\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsvertrag\"}]},{\"classes\":[\"page\"],\"components\":[{\"classes\":[\"header\"],\"components\":[{\"classes\":[\"header-left\"],\"components\":[{\"tagName\":\"h1\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"MITGLIEDSVERTRAG\"}]},{\"tagName\":\"h2\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_name}}\"}]}]},{\"type\":\"text\",\"classes\":[\"logo-placeholder\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                LOGO\\n            \"}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"PERSÖNLICHE DATEN\"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mitglied_id}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Anrede\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{anrede}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vorname}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nachname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nachname}}\"}]}]}]},{\"classes\":[\"address-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Straße\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{strasse}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Hausnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{hausnummer}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"PLZ\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{plz}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Ort\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}\"}]}]}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Telefonnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{telefon}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"E-Mail-Adresse\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{email}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mobil\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mobil}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Geburtsdatum\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{geburtsdatum}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"VERTRAGSDATEN\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"intro-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Ich habe mich für den nachfolgenden Tarif entschieden:\"}]},{\"classes\":[\"contract-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Tarifname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{tarif_name}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Höhe Betrag\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{betrag}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Aufnahmegebühr\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{aufnahmegebuehr}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mindestlaufzeit\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mindestlaufzeit}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nutzungsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nutzungsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsverlängerungsdauer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsverlaengerung}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kündigungsfrist\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kuendigungsfrist}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Zahlweise\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{zahlweise}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"total-box\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Gesamt (inkl. Pauschalen und Zusatzmodule)\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            {{betrag}} € {{zahlweise}}\\n        \"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\\n        \"}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"ivgjfp\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Vertragsnehmer\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 2: SEPA-LASTSCHRIFTMANDAT \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA-LASTSCHRIFTMANDAT\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.\"},{\"tagName\":\"br\",\"void\":true},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\\n        \"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname und Name (Kontoinhaber)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kontoinhaber}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kreditinstitut (Name)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kreditinstitut}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"BIC\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{bic}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"IBAN\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{iban}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA Mandatsreferenz-Nummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{sepa_referenz}}\"}]}]}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"itf9vg\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Kontoinhaber\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 3: ZAHLUNGSTERMINE \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"ZAHLUNGSTERMINE\"}]},{\"type\":\"textnode\",\"content\":\"\\n\\n        \\n                {{zahlungstermine}}\\n            \"},{\"type\":\"table\",\"droppable\":[\"tbody\",\"thead\",\"tfoot\"],\"components\":[{\"type\":\"thead\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"components\":[{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Fälligkeitsdatum\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Typ\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Beschreibung\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Betrag\"}]}]}]},{\"type\":\"tbody\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"classes\":[\"row\"],\"components\":[{\"type\":\"cell\",\"draggable\":[\"tr\"],\"classes\":[\"cell\"]}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]}]','[{\"selectors\":[],\"style\":{\"size\":\"a4\",\"margin-top\":\"2cm\",\"margin-right\":\"2cm\",\"margin-bottom\":\"2cm\",\"margin-left\":\"2cm\"},\"atRuleType\":\"page\",\"singleAtRule\":true},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"font-family\":\"Arial, sans-serif\",\"font-size\":\"11pt\",\"line-height\":\"1.4\",\"color\":\"rgb(51, 51, 51)\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"padding-top\":\"20px\",\"padding-right\":\"20px\",\"padding-bottom\":\"20px\",\"padding-left\":\"20px\"}},{\"selectors\":[\"page\"],\"style\":{\"width\":\"210mm\",\"min-height\":\"297mm\",\"padding-top\":\"20mm\",\"padding-right\":\"20mm\",\"padding-bottom\":\"20mm\",\"padding-left\":\"20mm\",\"margin-top\":\"0px\",\"margin-right\":\"auto\",\"margin-bottom\":\"0px\",\"margin-left\":\"auto\",\"background-image\":\"initial\",\"background-position-x\":\"initial\",\"background-position-y\":\"initial\",\"background-size\":\"initial\",\"background-repeat\":\"initial\",\"background-attachment\":\"initial\",\"background-origin\":\"initial\",\"background-clip\":\"initial\",\"background-color\":\"white\",\"break-after\":\"page\"}},{\"selectors\":[\"header\"],\"style\":{\"display\":\"flex\",\"justify-content\":\"space-between\",\"align-items\":\"flex-start\",\"margin-bottom\":\"30px\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h1\",\"style\":{\"font-size\":\"24pt\",\"font-weight\":\"bold\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"5px\",\"margin-left\":\"0px\",\"color\":\"rgb(51, 51, 51)\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h2\",\"style\":{\"font-size\":\"18pt\",\"font-weight\":\"normal\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"logo-placeholder\"],\"style\":{\"width\":\"120px\",\"height\":\"120px\",\"border-top-width\":\"2px\",\"border-right-width\":\"2px\",\"border-bottom-width\":\"2px\",\"border-left-width\":\"2px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"border-right-color\":\"rgb(51, 51, 51)\",\"border-bottom-color\":\"rgb(51, 51, 51)\",\"border-left-color\":\"rgb(51, 51, 51)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"border-top-left-radius\":\"50%\",\"border-top-right-radius\":\"50%\",\"border-bottom-right-radius\":\"50%\",\"border-bottom-left-radius\":\"50%\",\"display\":\"flex\",\"align-items\":\"center\",\"justify-content\":\"center\",\"font-size\":\"10pt\",\"color\":\"rgb(153, 153, 153)\"}},{\"selectors\":[\"section-title\"],\"style\":{\"font-size\":\"14pt\",\"font-weight\":\"bold\",\"margin-top\":\"25px\",\"margin-right\":\"0px\",\"margin-bottom\":\"15px\",\"margin-left\":\"0px\",\"text-transform\":\"uppercase\"}},{\"selectors\":[\"data-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"data-field\"],\"style\":{\"margin-bottom\":\"10px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field label\",\"style\":{\"display\":\"block\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\",\"margin-bottom\":\"3px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field .value\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-left-radius\":\"3px\",\"border-top-right-radius\":\"3px\",\"border-bottom-right-radius\":\"3px\",\"border-bottom-left-radius\":\"3px\",\"min-height\":\"20px\",\"font-size\":\"11pt\"}},{\"selectors\":[\"data-field-wide\"],\"style\":{\"grid-column-start\":\"1\",\"grid-column-end\":\"-1\"}},{\"selectors\":[\"address-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"2fr 1fr 1fr 2fr\",\"row-gap\":\"10px\",\"column-gap\":\"10px\"}},{\"selectors\":[\"contract-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"total-box\"],\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"12px\",\"padding-right\":\"12px\",\"padding-bottom\":\"12px\",\"padding-left\":\"12px\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"font-weight\":\"bold\",\"font-size\":\"12pt\"}},{\"selectors\":[\"legal-text\"],\"style\":{\"font-size\":\"10pt\",\"line-height\":\"1.6\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"color\":\"rgb(85, 85, 85)\"}},{\"selectors\":[\"signature-section\"],\"style\":{\"margin-top\":\"50px\",\"display\":\"flex\",\"justify-content\":\"space-between\"}},{\"selectors\":[\"signature-box\"],\"style\":{\"width\":\"45%\"}},{\"selectors\":[\"signature-line\"],\"style\":{\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"margin-top\":\"60px\",\"padding-top\":\"8px\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"footer\"],\"style\":{\"position\":\"absolute\",\"bottom\":\"15mm\",\"left\":\"20mm\",\"right\":\"20mm\",\"text-align\":\"center\",\"font-size\":\"8pt\",\"color\":\"rgb(102, 102, 102)\",\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"padding-top\":\"10px\"}},{\"selectors\":[\"footer-line\"],\"style\":{\"margin-top\":\"3px\",\"margin-right\":\"0px\",\"margin-bottom\":\"3px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table\",\"style\":{\"width\":\"100%\",\"border-collapse\":\"collapse\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table th\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"10px\",\"padding-right\":\"10px\",\"padding-bottom\":\"10px\",\"padding-left\":\"10px\",\"text-align\":\"left\",\"font-size\":\"10pt\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\"}},{\"selectors\":[],\"selectorsAdd\":\"table td\",\"style\":{\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"font-size\":\"10pt\"}},{\"selectors\":[\"intro-text\"],\"style\":{\"font-size\":\"10pt\",\"margin-bottom\":\"15px\"}},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"},{\"selectors\":[\"page\"],\"style\":{\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"border-top-width\":\"initial\",\"border-right-width\":\"initial\",\"border-bottom-width\":\"initial\",\"border-left-width\":\"initial\",\"border-top-style\":\"none\",\"border-right-style\":\"none\",\"border-bottom-style\":\"none\",\"border-left-style\":\"none\",\"border-top-color\":\"initial\",\"border-right-color\":\"initial\",\"border-bottom-color\":\"initial\",\"border-left-color\":\"initial\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"}]','vertrag',0,1,NULL,1,'2025-12-20 20:09:17','2025-12-20 20:09:17',NULL);
/*!40000 ALTER TABLE `vertragsvorlagen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `zahllaeufe`
--

DROP TABLE IF EXISTS `zahllaeufe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zahllaeufe` (
  `zahllauf_id` int NOT NULL AUTO_INCREMENT,
  `dojo_id` int DEFAULT NULL,
  `buchungsnummer` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Eindeutige Buchungsnummer (z.B. M-0045)',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Erstellungszeitpunkt',
  `forderungen_bis` date DEFAULT NULL COMMENT 'Forderungen bis einschließlich Datum',
  `geplanter_einzug` date DEFAULT NULL COMMENT 'Geplantes Einzugsdatum',
  `zahlungsanbieter` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'SEPA (Finion AG)' COMMENT 'Name des Zahlungsanbieters',
  `status` enum('geplant','offen','abgeschlossen','fehler') COLLATE utf8mb4_unicode_ci DEFAULT 'geplant' COMMENT 'Status des Zahllaufs',
  `anzahl_buchungen` int NOT NULL DEFAULT '0' COMMENT 'Anzahl der Buchungen/Mandate',
  `betrag` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Gesamtbetrag in EUR',
  `ruecklastschrift_anzahl` int DEFAULT '0' COMMENT 'Anzahl der Rücklastschriften',
  `ruecklastschrift_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Prozentsatz der Rücklastschriften',
  `csv_datei_pfad` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pfad zur CSV-Exportdatei',
  `xml_datei_pfad` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pfad zur XML-Exportdatei',
  `notizen` text COLLATE utf8mb4_unicode_ci COMMENT 'Zusätzliche Notizen zum Zahllauf',
  `ersteller_user_id` int DEFAULT NULL COMMENT 'ID des Users der den Zahllauf erstellt hat',
  `abgeschlossen_am` timestamp NULL DEFAULT NULL COMMENT 'Zeitpunkt der Abschließung',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`zahllauf_id`),
  UNIQUE KEY `buchungsnummer` (`buchungsnummer`),
  KEY `idx_buchungsnummer` (`buchungsnummer`),
  KEY `idx_status` (`status`),
  KEY `idx_erstellt_am` (`erstellt_am`),
  KEY `idx_geplanter_einzug` (`geplanter_einzug`),
  KEY `idx_dojo_id` (`dojo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SEPA-Lastschriftläufe mit Buchungsinformationen';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `zahllaeufe`
--

LOCK TABLES `zahllaeufe` WRITE;
/*!40000 ALTER TABLE `zahllaeufe` DISABLE KEYS */;
/*!40000 ALTER TABLE `zahllaeufe` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `zahlungen`
--

DROP TABLE IF EXISTS `zahlungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zahlungen` (
  `zahlung_id` int NOT NULL AUTO_INCREMENT,
  `rechnung_id` int NOT NULL,
  `betrag` decimal(10,2) NOT NULL,
  `zahlungsdatum` date NOT NULL,
  `zahlungsart` enum('bar','ueberweisung','lastschrift','kreditkarte','paypal') COLLATE utf8mb4_unicode_ci NOT NULL,
  `referenz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`zahlung_id`),
  KEY `idx_rechnung` (`rechnung_id`),
  KEY `idx_datum` (`zahlungsdatum`),
  CONSTRAINT `zahlungen_ibfk_1` FOREIGN KEY (`rechnung_id`) REFERENCES `rechnungen` (`rechnung_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `zahlungen`
--

LOCK TABLES `zahlungen` WRITE;
/*!40000 ALTER TABLE `zahlungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `zahlungen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `zahlungszyklen`
--

DROP TABLE IF EXISTS `zahlungszyklen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zahlungszyklen` (
  `zyklus_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `intervall_tage` int NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `aktiv` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`zyklus_id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `zahlungszyklen`
--

LOCK TABLES `zahlungszyklen` WRITE;
/*!40000 ALTER TABLE `zahlungszyklen` DISABLE KEYS */;
INSERT INTO `zahlungszyklen` VALUES (1,'Täglich',1,'Tägliche Zahlung',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(2,'Wöchentlich',7,'Wöchentliche Zahlung',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(3,'14-tägig',14,'14-tägige Zahlung',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(4,'Monatlich',30,'Monatliche Zahlung',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(5,'Vierteljährlich',90,'Vierteljährliche Zahlung (3 Monate)',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(6,'Halbjährlich',180,'Halbjährliche Zahlung (6 Monate)',1,'2025-09-12 13:13:25','2025-09-12 13:13:25'),(7,'Jährlich',365,'Jährliche Zahlung',1,'2025-09-12 13:13:25','2025-09-12 13:13:25');
/*!40000 ALTER TABLE `zahlungszyklen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `zehnerkarten`
--

DROP TABLE IF EXISTS `zehnerkarten`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zehnerkarten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mitglied_id` int NOT NULL,
  `tarif_id` int NOT NULL,
  `gekauft_am` date NOT NULL,
  `gueltig_bis` date NOT NULL,
  `einheiten_gesamt` int NOT NULL DEFAULT '10',
  `einheiten_verbleibend` int NOT NULL DEFAULT '10',
  `status` enum('aktiv','aufgebraucht','abgelaufen') COLLATE utf8mb4_unicode_ci DEFAULT 'aktiv',
  `preis_cents` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tarif_id` (`tarif_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_status` (`status`),
  KEY `idx_gueltig_bis` (`gueltig_bis`),
  CONSTRAINT `zehnerkarten_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `zehnerkarten_ibfk_2` FOREIGN KEY (`tarif_id`) REFERENCES `tarife` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `zehnerkarten`
--

LOCK TABLES `zehnerkarten` WRITE;
/*!40000 ALTER TABLE `zehnerkarten` DISABLE KEYS */;
/*!40000 ALTER TABLE `zehnerkarten` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `zehnerkarten_buchungen`
--

DROP TABLE IF EXISTS `zehnerkarten_buchungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zehnerkarten_buchungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zehnerkarte_id` int NOT NULL,
  `mitglied_id` int NOT NULL,
  `buchungsdatum` date NOT NULL,
  `buchungszeit` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `einheiten` int NOT NULL DEFAULT '1',
  `notiz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_daily_booking` (`zehnerkarte_id`,`buchungsdatum`),
  KEY `idx_zehnerkarte` (`zehnerkarte_id`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_buchungsdatum` (`buchungsdatum`),
  CONSTRAINT `zehnerkarten_buchungen_ibfk_1` FOREIGN KEY (`zehnerkarte_id`) REFERENCES `zehnerkarten` (`id`) ON DELETE CASCADE,
  CONSTRAINT `zehnerkarten_buchungen_ibfk_2` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `zehnerkarten_buchungen`
--

LOCK TABLES `zehnerkarten_buchungen` WRITE;
/*!40000 ALTER TABLE `zehnerkarten_buchungen` DISABLE KEYS */;
/*!40000 ALTER TABLE `zehnerkarten_buchungen` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-09 13:32:52
