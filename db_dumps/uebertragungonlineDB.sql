-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: dojo
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

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
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vorname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nachname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rolle` enum('super_admin','admin','mitarbeiter','eingeschraenkt') COLLATE utf8mb4_unicode_ci DEFAULT 'eingeschraenkt',
  `berechtigungen` json DEFAULT NULL,
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
  KEY `idx_letzter_login` (`letzter_login`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES (1,'admin','admin@dojo.local','$2b$10$YourHashedPasswordHere','System','Administrator','super_admin','{\"admins\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"berichte\": {\"lesen\": true, \"exportieren\": true}, \"finanzen\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"dashboard\": {\"lesen\": true}, \"vertraege\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"mitglieder\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"pruefungen\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"stundenplan\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}, \"einstellungen\": {\"lesen\": true, \"loeschen\": true, \"erstellen\": true, \"bearbeiten\": true}}',1,1,NULL,0,NULL,NULL,NULL,NULL,NULL,'2025-11-16 07:39:52',NULL,'2025-11-16 07:39:52',NULL);
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `aktive_dokumente`
--

DROP TABLE IF EXISTS `aktive_dokumente`;
/*!50001 DROP VIEW IF EXISTS `aktive_dokumente`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `aktive_dokumente` AS SELECT 
 1 AS `id`,
 1 AS `name`,
 1 AS `typ`,
 1 AS `beschreibung`,
 1 AS `dateiname`,
 1 AS `dateipfad`,
 1 AS `dateityp`,
 1 AS `dateigroesse`,
 1 AS `erstellt_am`,
 1 AS `erstellt_von`,
 1 AS `parameter`,
 1 AS `status`,
 1 AS `downloads`,
 1 AS `letzter_download`,
 1 AS `gueltig_bis`,
 1 AS `ersteller_name`*/;
SET character_set_client = @saved_cs_client;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anwesenheit`
--

LOCK TABLES `anwesenheit` WRITE;
/*!40000 ALTER TABLE `anwesenheit` DISABLE KEYS */;
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
  `status` enum('anwesend','verspätet','entschuldigt','unentschuldigt','abgebrochen') NOT NULL DEFAULT 'anwesend',
  `bemerkung` varchar(255) DEFAULT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_anwesenheit` (`mitglied_id`,`stundenplan_id`,`datum`),
  KEY `stundenplan_id` (`stundenplan_id`),
  CONSTRAINT `anwesenheit_protokoll_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE,
  CONSTRAINT `anwesenheit_protokoll_ibfk_2` FOREIGN KEY (`stundenplan_id`) REFERENCES `stundenplan` (`stundenplan_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anwesenheit_protokoll`
--

LOCK TABLES `anwesenheit_protokoll` WRITE;
/*!40000 ALTER TABLE `anwesenheit_protokoll` DISABLE KEYS */;
/*!40000 ALTER TABLE `anwesenheit_protokoll` ENABLE KEYS */;
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
INSERT INTO `artikel` VALUES (1,1,NULL,'Wasser 0,5L','Stilles Mineralwasser',NULL,'GET001',0,150,19.00,50,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(2,1,NULL,'Apfelschorle 0,5L','Erfrischende Apfelschorle',NULL,'GET002',0,200,19.00,30,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(3,1,NULL,'Energy Drink','Koffeingetränk für mehr Energie',NULL,'GET003',0,250,19.00,25,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(4,1,NULL,'Proteinshake','Fertig gemischter Proteinshake',NULL,'GET004',0,350,19.00,20,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(5,2,NULL,'Proteinriegel','High-Protein Riegel 50g',NULL,'SNA001',0,280,7.00,40,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(6,2,NULL,'Nussmischung','Gesunde Nuss-Mix 100g',NULL,'SNA002',0,320,7.00,35,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(7,2,NULL,'Banane','Frische Banane',NULL,'SNA003',0,80,7.00,0,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(8,3,NULL,'Handschuhe','Boxhandschuhe Größe M',NULL,'EQU001',0,2500,19.00,15,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(9,3,NULL,'Gürtel','Karate-Gürtel weiß',NULL,'EQU002',0,1200,19.00,20,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(10,3,NULL,'Schutzausrüstung','Komplette Schutzausrüstung',NULL,'EQU003',0,4500,19.00,8,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(11,4,NULL,'Dojo-T-Shirt','Baumwoll-T-Shirt mit Dojo-Logo',NULL,'BEK001',0,1800,19.00,25,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(12,4,NULL,'Trainingshose','Bequeme Trainingshose',NULL,'BEK002',0,2200,19.00,18,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(13,4,NULL,'Hoodie','Kapuzenpullover mit Dojo-Logo',NULL,'BEK003',0,3500,19.00,12,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(14,5,NULL,'Whey Protein','Molkenprotein 1kg',NULL,'NAE001',0,2500,7.00,10,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(15,5,NULL,'Kreatin','Kreatin Monohydrat 500g',NULL,'NAE002',0,1800,7.00,15,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42'),(16,5,NULL,'Multivitamin','Tägliche Vitamin-Tabletten',NULL,'NAE003',0,1200,7.00,20,0,1,NULL,NULL,'#FFFFFF',1,1,'2025-10-18 04:04:42','2025-10-18 04:04:42');
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
-- Temporary view structure for view `artikelgruppen_hierarchie`
--

DROP TABLE IF EXISTS `artikelgruppen_hierarchie`;
/*!50001 DROP VIEW IF EXISTS `artikelgruppen_hierarchie`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `artikelgruppen_hierarchie` AS SELECT 
 1 AS `id`,
 1 AS `name`,
 1 AS `beschreibung`,
 1 AS `parent_id`,
 1 AS `sortierung`,
 1 AS `aktiv`,
 1 AS `icon`,
 1 AS `farbe`,
 1 AS `typ`,
 1 AS `vollstaendiger_name`,
 1 AS `erstellt_am`,
 1 AS `aktualisiert_am`*/;
SET character_set_client = @saved_cs_client;

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
  `zahlungsart` varchar(50) DEFAULT NULL,
  `bezahlt` tinyint(1) DEFAULT '0',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`beitrag_id`),
  KEY `mitglied_id` (`mitglied_id`),
  KEY `idx_beitraege_dojo_id` (`dojo_id`),
  CONSTRAINT `beitraege_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `beitraege`
--

LOCK TABLES `beitraege` WRITE;
/*!40000 ALTER TABLE `beitraege` DISABLE KEYS */;
/*!40000 ALTER TABLE `beitraege` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `break_even_berechnungen`
--

DROP TABLE IF EXISTS `break_even_berechnungen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `break_even_berechnungen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fixkosten` json NOT NULL,
  `variable_kosten` json NOT NULL,
  `durchschnittsbeitrag` decimal(10,2) NOT NULL,
  `break_even_mitglieder` int NOT NULL,
  `break_even_umsatz` decimal(10,2) NOT NULL,
  `sicherheitspuffer_prozent` decimal(5,2) NOT NULL,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `break_even_berechnungen`
--

LOCK TABLES `break_even_berechnungen` WRITE;
/*!40000 ALTER TABLE `break_even_berechnungen` DISABLE KEYS */;
INSERT INTO `break_even_berechnungen` VALUES (1,'{\"miete\": 3280, \"strom\": 80, \"wasser\": 40, \"telefon\": 0, \"wartung\": 0, \"internet\": 40, \"software\": 0, \"reinigung\": 0, \"versicherung\": 10}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,47,3478.00,20.00,'2025-10-09 08:12:39'),(2,'{\"miete\": 3280, \"strom\": 80, \"wasser\": 80, \"telefon\": 0, \"wartung\": 0, \"internet\": 40, \"software\": 0, \"reinigung\": 0, \"versicherung\": 10}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-09 08:14:58'),(3,'{\"miete\": 3280, \"strom\": 80, \"wasser\": 80, \"telefon\": 0, \"wartung\": 0, \"internet\": 40, \"software\": 0, \"reinigung\": 0, \"versicherung\": 10}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-09 08:16:22'),(4,'{\"miete\": 3280, \"strom\": 0, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 0}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,45,3330.00,20.00,'2025-10-09 08:16:34'),(5,'{\"miete\": 3277, \"strom\": 0, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 0}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,45,3330.00,20.00,'2025-10-09 08:18:52'),(6,'{\"miete\": 3280, \"strom\": 0, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 0}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,45,3330.00,20.00,'2025-10-09 08:20:37'),(7,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-25 04:48:51'),(8,'{\"miete\": 2500, \"strom\": 120, \"versicherung\": 180}','{\"marketing\": 200, \"ausruestung\": 300}',85.00,39,3315.00,20.00,'2025-10-25 04:54:07'),(9,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 0, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,48,3552.00,20.00,'2025-10-25 04:54:54'),(10,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,49,3626.00,20.00,'2025-10-25 04:57:35'),(11,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,49,3626.00,20.00,'2025-10-26 05:53:36'),(12,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',64.00,57,3648.00,20.00,'2025-10-26 05:53:45'),(13,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',64.00,57,3648.00,20.00,'2025-10-26 05:53:46'),(14,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',74.00,49,3626.00,20.00,'2025-10-26 05:54:29'),(15,'{\"miete\": 3280, \"strom\": 100, \"wasser\": 100, \"telefon\": 0, \"wartung\": 0, \"internet\": 0, \"software\": 0, \"reinigung\": 0, \"versicherung\": 120}','{\"events\": 0, \"material\": 0, \"marketing\": 0, \"ausruestung\": 0, \"fortbildungen\": 0}',64.00,57,3648.00,20.00,'2025-11-06 12:26:36');
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
  `aktivitaet_typ` varchar(64) NOT NULL,
  `beschreibung` varchar(512) DEFAULT NULL,
  `benutzer_ip` varchar(64) DEFAULT NULL,
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
  `freund_name` varchar(255) DEFAULT NULL,
  `freund_email` varchar(255) NOT NULL,
  `einladungs_token` varchar(64) NOT NULL,
  `token_gueltig_bis` datetime NOT NULL,
  `status` enum('eingeladen','email_gesendet','registriert','aktiviert','abgelehnt','abgelaufen') DEFAULT 'eingeladen',
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
  `email_typ` enum('einladung','erinnerung') NOT NULL,
  `empfaenger_email` varchar(255) NOT NULL,
  `betreff` varchar(255) DEFAULT NULL,
  `status` enum('gesendet','fehler') NOT NULL,
  `gesendet_am` datetime DEFAULT NULL,
  `provider_message_id` varchar(255) DEFAULT NULL,
  `fehler_nachricht` text,
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
  `gruppe_name` varchar(255) NOT NULL,
  `max_mitglieder` int DEFAULT '0',
  `aktuelle_mitglieder` int DEFAULT '0',
  `ersteller_registrierung_id` int DEFAULT NULL,
  `status` enum('aktiv','archiviert','geloescht') DEFAULT 'aktiv',
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
  `checkin_method` enum('touch','qr_code','manual','nfc','admin') NOT NULL DEFAULT 'touch',
  `qr_code_used` varchar(255) DEFAULT NULL,
  `device_info` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `status` enum('active','completed','cancelled','no_show') NOT NULL DEFAULT 'active',
  `bemerkung` varchar(255) DEFAULT NULL,
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
  CONSTRAINT `chk_checkout_after_checkin` CHECK (((`checkout_time` is null) or (`checkout_time` >= `checkin_time`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checkins`
--

LOCK TABLES `checkins` WRITE;
/*!40000 ALTER TABLE `checkins` DISABLE KEYS */;
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
  `export_type` enum('booking','customer','invoice') DEFAULT 'booking',
  `datev_booking_id` varchar(100) DEFAULT NULL COMMENT 'DATEV Buchungs-ID',
  `datev_response` json DEFAULT NULL COMMENT 'Vollst├ñndige DATEV API Response',
  `export_status` enum('pending','processing','success','failed','retry') DEFAULT 'pending',
  `error_message` text,
  `retry_count` int DEFAULT '0',
  `account_from` varchar(10) DEFAULT NULL COMMENT 'Soll-Konto (z.B. 1200 Debitor)',
  `account_to` varchar(10) DEFAULT NULL COMMENT 'Haben-Konto (z.B. 1000 Bank)',
  `booking_text` varchar(255) DEFAULT NULL COMMENT 'Buchungstext',
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payment_intent_id` (`payment_intent_id`),
  KEY `idx_export_status` (`export_status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_retry` (`export_status`,`retry_count`),
  CONSTRAINT `datev_exports_ibfk_1` FOREIGN KEY (`payment_intent_id`) REFERENCES `stripe_payment_intents` (`id`) ON DELETE CASCADE
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
  `dojoname` varchar(255) NOT NULL,
  `inhaber` varchar(255) NOT NULL,
  `strasse` varchar(255) DEFAULT NULL,
  `hausnummer` varchar(50) DEFAULT NULL,
  `plz` varchar(10) DEFAULT NULL,
  `ort` varchar(100) DEFAULT NULL,
  `telefon` varchar(50) DEFAULT NULL,
  `mobil` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `internet` varchar(255) DEFAULT NULL,
  `untertitel` varchar(255) DEFAULT NULL COMMENT 'z.B. "Traditionelles Karate seit 1985"',
  `vertreter` varchar(255) DEFAULT NULL COMMENT 'Stellvertreter/2. Vorsitzender',
  `gruendungsjahr` int DEFAULT NULL,
  `mitgliederzahl_aktuell` int DEFAULT '0',
  `land` varchar(100) DEFAULT 'Deutschland',
  `fax` varchar(30) DEFAULT NULL,
  `email_info` varchar(255) DEFAULT NULL COMMENT 'info@dojo.de',
  `email_anmeldung` varchar(255) DEFAULT NULL COMMENT 'anmeldung@dojo.de',
  `steuernummer` varchar(50) DEFAULT NULL,
  `umsatzsteuer_id` varchar(50) DEFAULT NULL COMMENT 'USt-IdNr.',
  `finanzamt` varchar(255) DEFAULT NULL,
  `steuerberater` varchar(255) DEFAULT NULL,
  `steuerberater_telefon` varchar(30) DEFAULT NULL,
  `umsatzsteuerpflichtig` tinyint(1) DEFAULT '0',
  `kleinunternehmer` tinyint(1) DEFAULT '0' COMMENT '§19 UStG',
  `gemeinnuetzig` tinyint(1) DEFAULT '0',
  `freistellungsbescheid_datum` date DEFAULT NULL,
  `rechtsform` enum('Verein','GmbH','Einzelunternehmen','GbR','UG','AG') DEFAULT 'Verein',
  `vereinsregister_nr` varchar(50) DEFAULT NULL,
  `amtsgericht` varchar(255) DEFAULT NULL,
  `handelsregister_nr` varchar(50) DEFAULT NULL,
  `geschaeftsfuehrer` varchar(255) DEFAULT NULL,
  `vorstand_1_vorsitzender` varchar(255) DEFAULT NULL,
  `vorstand_2_vorsitzender` varchar(255) DEFAULT NULL,
  `vorstand_kassenwart` varchar(255) DEFAULT NULL,
  `vorstand_schriftfuehrer` varchar(255) DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `bank_iban` varchar(50) DEFAULT NULL,
  `bank_bic` varchar(20) DEFAULT NULL,
  `bank_inhaber` varchar(255) DEFAULT NULL,
  `bank_verwendungszweck` varchar(255) DEFAULT NULL,
  `sepa_glaeubiger_id` varchar(35) DEFAULT NULL,
  `iban` varchar(34) DEFAULT NULL,
  `bic` varchar(11) DEFAULT NULL,
  `bank` varchar(100) DEFAULT NULL,
  `paypal_email` varchar(255) DEFAULT NULL,
  `lastschrift_aktiv` tinyint(1) DEFAULT '0',
  `haftpflicht_versicherung` varchar(255) DEFAULT NULL,
  `haftpflicht_police_nr` varchar(100) DEFAULT NULL,
  `haftpflicht_ablauf` date DEFAULT NULL,
  `unfallversicherung` varchar(255) DEFAULT NULL,
  `unfallversicherung_police_nr` varchar(100) DEFAULT NULL,
  `gebaeudeversicherung` varchar(255) DEFAULT NULL,
  `agb_text` text,
  `datenschutz_text` text,
  `widerrufsrecht_text` text,
  `impressum_text` text,
  `kuendigungsfrist_monate` int DEFAULT '3',
  `mindestlaufzeit_monate` int DEFAULT '12',
  `probezeit_tage` int DEFAULT '14',
  `oeffnungszeiten` json DEFAULT NULL COMMENT '{"montag": {"von": "16:00", "bis": "22:00"}}',
  `feiertage_geschlossen` tinyint(1) DEFAULT '1',
  `ferien_geschlossen` tinyint(1) DEFAULT '0',
  `notfallkontakt_name` varchar(255) DEFAULT NULL,
  `notfallkontakt_telefon` varchar(30) DEFAULT NULL,
  `hausmeister_kontakt` varchar(255) DEFAULT NULL,
  `facebook_url` varchar(500) DEFAULT NULL,
  `instagram_url` varchar(500) DEFAULT NULL,
  `youtube_url` varchar(500) DEFAULT NULL,
  `twitter_url` varchar(500) DEFAULT NULL,
  `whatsapp_nummer` varchar(30) DEFAULT NULL,
  `newsletter_aktiv` tinyint(1) DEFAULT '0',
  `google_maps_url` text,
  `kampfkunst_stil` varchar(255) DEFAULT NULL COMMENT 'z.B. "Shotokan Karate"',
  `verband` varchar(255) DEFAULT NULL COMMENT 'z.B. "DKV - Deutscher Karate Verband"',
  `verband_mitgliedsnummer` varchar(100) DEFAULT NULL,
  `lizenz_trainer_a` int DEFAULT '0',
  `lizenz_trainer_b` int DEFAULT '0',
  `lizenz_trainer_c` int DEFAULT '0',
  `beitrag_erwachsene` decimal(10,2) DEFAULT NULL,
  `beitrag_kinder` decimal(10,2) DEFAULT NULL,
  `beitrag_familien` decimal(10,2) DEFAULT NULL,
  `aufnahmegebuehr` decimal(10,2) DEFAULT NULL,
  `kaution` decimal(10,2) DEFAULT NULL,
  `zahlungsarten` json DEFAULT NULL COMMENT '["Lastschrift", "Überweisung", "Bar"]',
  `mahnung_gebuehr` decimal(10,2) DEFAULT '5.00',
  `rueckbuchung_gebuehr` decimal(10,2) DEFAULT '10.00',
  `logo_url` varchar(500) DEFAULT NULL,
  `favicon_url` varchar(500) DEFAULT NULL,
  `theme_farbe` varchar(20) DEFAULT '#DAA520' COMMENT 'Dojo Gold',
  `sprache` varchar(10) DEFAULT 'de',
  `zeitzone` varchar(50) DEFAULT 'Europe/Berlin',
  `waehrung` varchar(10) DEFAULT 'EUR',
  `backup_email` varchar(255) DEFAULT NULL,
  `dsgvo_beauftragte` varchar(255) DEFAULT NULL,
  `max_mitglieder` int DEFAULT '500',
  `max_trainer` int DEFAULT '20',
  `max_kurse` int DEFAULT '50',
  `auto_backup` tinyint(1) DEFAULT '1',
  `email_benachrichtigungen` tinyint(1) DEFAULT '1',
  `sms_benachrichtigungen` tinyint(1) DEFAULT '0',
  `auszeichnungen` text COMMENT 'Pokale, Erfolge, etc.',
  `gruender_meister` varchar(255) DEFAULT NULL,
  `traditionslinie` text,
  `dojo_regeln` text,
  `pruefungsordnung` text,
  `graduierungssystem` varchar(255) DEFAULT NULL COMMENT 'z.B. "Kyu/Dan System"',
  `naechste_pruefung` date DEFAULT NULL,
  `naechstes_turnier` date DEFAULT NULL,
  `lehrgang_termine` text,
  `api_key_google` varchar(255) DEFAULT NULL,
  `api_key_facebook` varchar(255) DEFAULT NULL,
  `api_key_payment` varchar(255) DEFAULT NULL,
  `webhook_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_backup` timestamp NULL DEFAULT NULL,
  `version` varchar(20) DEFAULT '1.0',
  `payment_provider` enum('manual_sepa','stripe_datev') DEFAULT 'manual_sepa' COMMENT 'Gew├ñhltes Zahlungssystem',
  `stripe_secret_key` varchar(255) DEFAULT NULL COMMENT 'Stripe Secret Key (verschl├╝sselt)',
  `stripe_publishable_key` varchar(255) DEFAULT NULL COMMENT 'Stripe Publishable Key',
  `datev_api_key` varchar(255) DEFAULT NULL COMMENT 'DATEV API Key (verschl├╝sselt)',
  `datev_consultant_number` varchar(20) DEFAULT NULL COMMENT 'DATEV Beraternummer',
  `datev_client_number` varchar(20) DEFAULT NULL COMMENT 'DATEV Mandantennummer',
  `dsgvo_text` longtext COMMENT 'Datenschutzerkl├ñrung gem├ñ├ƒ DSGVO',
  `dojo_regeln_text` longtext COMMENT 'Dojo-Regeln und Verhaltenskodex',
  `hausordnung_text` longtext COMMENT 'Hausordnung f├╝r die R├ñumlichkeiten',
  `widerrufsbelehrung_text` longtext COMMENT 'Widerrufsbelehrung nach deutschem Recht',
  `vertragsbedingungen_text` longtext COMMENT 'Spezifische Vertragsbedingungen f├╝r Mitgliedschaften',
  `steuer_status` enum('kleinunternehmer','regelbesteuerung') DEFAULT 'kleinunternehmer' COMMENT 'Steuerstatus des Dojos',
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
  `farbe` varchar(7) DEFAULT '#FFD700' COMMENT 'Dojo-Farbe (Hex)',
  `finanzamt_name` varchar(255) DEFAULT NULL COMMENT 'Zust├ñndiges Finanzamt',
  `ust_id` varchar(50) DEFAULT NULL COMMENT 'USt-IdNr.',
  `aktualisiert_am` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `theme_scheme` varchar(50) DEFAULT 'default',
  `haftungsausschluss_text` text,
  PRIMARY KEY (`id`),
  KEY `idx_dojo_rechtsform` (`rechtsform`),
  KEY `idx_dojo_umsatzsteuer` (`umsatzsteuerpflichtig`),
  KEY `idx_dojo_updated` (`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dojo`
--

LOCK TABLES `dojo` WRITE;
/*!40000 ALTER TABLE `dojo` DISABLE KEYS */;
INSERT INTO `dojo` VALUES (2,'Tiger & Dragon Association - International','Sascha Schreiner','Geigelsteinstr. ','14','84137','Vilsbbiburg','015752461776','','headquarter@tda-intl.com','https://www.tda-intl.com','','',NULL,0,'Deutschland','','','','',NULL,NULL,'',NULL,0,0,0,NULL,'Einzelunternehmen','','','','','','','','',NULL,NULL,NULL,'','','','','','','',0,'',NULL,NULL,'',NULL,'','Allgemeine Geschäftsbedingungen (AGB)\n\nder Kampfsportschule Schreiner\nOhmstraße 14, 84137 Vilsbiburg\n(im Folgenden „Schule“, „Anbieter“)\n\nStand: 31.10.2025\n\n1. Geltung, Vertragsparteien, Änderungen\n\n1.1. Diese AGB gelten für alle Verträge, Leistungen, Kurse und Mitgliedschaften, die zwischen der Kampfsportschule Schreiner (im Folgenden „Schule“) und den Teilnehmenden bzw. Mitgliedern (im Folgenden „Mitglied“, „Teilnehmer“, „Kunde“) geschlossen werden.\n\n1.2. Abweichende Bedingungen des Kunden werden ausdrücklich zurückgewiesen, es sei denn, die Schule hat ihnen schriftlich ausdrücklich zugestimmt.\n\n1.3. Einzelverträge und schriftliche Vereinbarungen haben Vorrang vor diesen AGB.\n\n1.4. Änderungen oder Ergänzungen dieser AGB bedürfen zur Wirksamkeit der Schriftform, sofern nicht ausdrücklich etwas anderes geregelt ist.\n\n1.5. Die Schule behält sich vor, einzelne Regelungen dieser AGB mit Wirkung für die Zukunft zu ändern. Änderungen werden dem Mitglied mindestens vier Wochen vor Inkrafttreten in Textform (z. B. E‑Mail, Aushang, Post) bekannt gegeben. Widerspricht das Mitglied der Änderung nicht schriftlich bis zum Inkrafttreten, gelten die Änderungen als angenommen. Auf die Bedeutung der Widerspruchsfrist wird die Schule den Teilnehmenden bei Bekanntgabe besonders hinweisen.\n\n2. Vertragsabschluss, Teilnahmevoraussetzungen\n\n2.1. Der Vertrag über die Teilnahme an Kursen, das Training oder eine Mitgliedschaft kommt zustande durch Unterzeichnung eines schriftlichen Vertrags oder eines Anmeldeformulars oder – soweit angeboten – durch Elektronische Anmeldung mit Bestätigung durch die Schule.\n\n2.2. Minderjährige (unter 18 Jahren) dürfen einen Vertrag nur mit Einwilligung der gesetzlichen Vertreter schließen. Diese müssen durch Unterschrift zustimmen.\n\n2.3. Vor Beginn der Teilnahme ist ein Gesundheitsfragebogen/Erklärung zur Sporttauglichkeit durch den Teilnehmenden oder – bei Minderjährigen – durch die gesetzlichen Vertreter auszufüllen. Der Teilnehmende bestätigt damit, dass keine medizinischen Einwände gegen die Teilnahme bestehen, oder er legt ein ärztliches Attest vor, wenn gesundheitliche Risiken bestehen.\n\n2.4. Der Anbieter kann die Teilnahme verweigern, wenn der Gesundheitszustand des Teilnehmenden Bedenken aufwirft, insbesondere wenn eine Gefährdung für sich oder andere bestehen könnte.\n\n3. Leistungsumfang und Nutzung\n\n3.1. Gegenstand der Leistungen sind Trainings-, Kurs- und Unterrichtsangebote im Bereich Kampfsport, Selbstverteidigung, Fitness-Training etc., sowie gegebenenfalls Zusatzleistungen (z. B. Personal Training, Seminare, Prüfungen).\n\n3.2. Der konkrete Leistungsumfang ergibt sich aus dem Vertrag bzw. der Leistungsbeschreibung im Angebot der Schule.\n\n3.3. Die Nutzung der Räumlichkeiten, der Ausstattung und Hilfsmittel erfolgt nur zu dem im Vertrag festgelegten Umfang und nach Maßgabe der Hausordnung.\n\n3.4. Eine Übertragung der Mitgliedschaft oder der Teilnahmeberechtigung auf Dritte ist ausgeschlossen, sofern nichts anderes ausdrücklich vereinbart ist.\n\n4. Pflichten der Mitglieder / Teilnehmer\n\n4.1. Die Mitglieder verpflichten sich insbesondere:\n\ndie Anweisungen der Trainer, Übungsleiter oder des Personals zu befolgen;\n\nsich an die Hausordnung sowie Sicherheits- und Hygienevorschriften zu halten;\n\nkeine Handlungen vorzunehmen, die Gefahr für Leib, Leben oder Eigentum anderer darstellen;\n\nvor oder während der Teilnahme auftretende Unwohlsein, gesundheitliche Beschwerden oder Verletzungen unverzüglich dem Trainer oder der Schule anzuzeigen;\n\neigenes Trainingsmaterial (z. B. geeignete Kleidung, Schutzausrüstung, Getränke) mitzubringen, sofern nicht durch die Schule gestellt;\n\nSauberkeit, Ordnung und Rücksicht auf andere Teilnehmende zu wahren.\n\n4.2. Bei groben oder wiederholten Pflichtverletzungen kann die Schule den Vertrag außerordentlich kündigen (siehe Ziffer 8).\n\n4.3. Das Mitglied ist verpflichtet, Änderungen seiner Kontakt- oder Bankdaten unverzüglich mitzuteilen.\n\n5. Beiträge, Preise, Zahlung\n\n5.1. Die Höhe der Beiträge, Kursgebühren und Zusatzkosten ergibt sich aus der aktuellen Preisliste bzw. dem Vertrag.\n\n5.2. Die Beiträge sind regelmäßig im Voraus – meist monatlich, vierteljährlich oder jährlich – zu entrichten. Der genaue Fälligkeitstermin ergibt sich aus dem Vertrag.\n\n5.3. Bei Zahlungsverzug gelten folgende Regelungen:\n\nNach Mahnung wird eine Mahngebühr (fester Betrag oder Prozentsatz) erhoben;\n\nBei Nichtzahlung kann die Schule den Zutritt verweigern, bis der Rückstand beglichen ist;\n\nNach einer bestimmten Frist (z. B. 2–3 Monate) kann die Schule den Vertrag kündigen und die Rückstände und den restlichen ausstehenden Betrag bis zur Beendigung des Vertrages einfordern.\n\n5.4. Bei Verträgen über einen bestimmten Zeitraum (z. B. Jahresvertrag) wird bei vorzeitiger Beendigung durch das Mitglied keine anteilige Rückerstattung geleistet, sofern nicht ausdrücklich anders vereinbart oder gesetzlich vorgeschrieben.\n\n5.5. Sonderleistungen oder Zusatzangebote (z. B. Privatstunden, Prüfungsgebühren) werden gesondert berechnet und sind ebenfalls fristgerecht zu zahlen.\n\n5.6. Die Schule behält sich vor, Beiträge und Gebühren anzupassen (z. B. wegen gestiegener Kosten). Eine Erhöhung wird dem Mitglied mindestens vier Wochen vorher in Textform mitgeteilt. Widerspricht das Mitglied nicht fristgerecht schriftlich, gilt die Erhöhung als genehmigt. Ein Sonderkündigungsrecht wird nicht gewährleistet.\n\n6. Vertragsdauer und Kündigung\n\n6.1. Vertragsdauer und Kündigungsfristen ergeben sich aus dem jeweiligen Vertrag (z. B. Monat auf Monatsbasis, Mindestvertragsdauer, Laufzeit, Verlängerung).\n\n6.2. Die Kündigung bedarf der Schriftform (Brief, E-Mail, – sofern im Vertrag zugelassen – elektronisch), sofern nicht anders vereinbart.\n\n6.3. Bei Verträgen mit Mindestlaufzeit ist eine ordentliche Kündigung frühestens zum Ende der Mindestlaufzeit möglich. Danach gilt meist eine Kündigungsfrist (z. B. 1–3 Monate).\n\n6.4. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor:\n\nwenn eine Partei ihre vertraglichen Pflichten schwerwiegend verletzt;\n\nbei erheblicher Gesundheitsgefährdung des Mitglieds;\n\nbei Insolvenz oder Einstellung des Geschäftsbetriebs der Schule.\n\n7. Unterbrechung / Ruhen des Vertrages\n\n7.1. In bestimmten Ausnahmefällen (z. B. längere Krankheit, Schwangerschaft, Auslandsaufenthalt) kann der Vertrag auf schriftlichen Antrag und Nachweis befristet ruhen. Die Mindestdauer, Höchstdauer und Bedingungen für einen solchen „Freeze“ sind im Vertrag oder der Preisliste festzulegen.\n\n7.2. Für Ruhtage ist in der Regel ein Entgelt bzw. Verwaltungskosten oder ein reduzierter Beitrag zu erheben.\n\n7.3. Während der Ruhezeiten besteht kein Anspruch auf Nutzung der Leistungen, es sei denn, es wird ausdrücklich etwas Anderes vereinbart.\n\n8. Haftung, Versicherung, Ausschluss\n\n8.1. Die Schule haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung oder auf Vorsatz/Grobe Fahrlässigkeit der Schule oder ihrer Erfüllungsgehilfen beruhen.\n\n8.2. Für sonstige Schäden haftet die Schule nur bei Vorsatz oder grober Fahrlässigkeit, es sei denn, eine Pflichtverletzung betrifft eine wesentliche Vertragspflicht (Kardinalpflicht). In diesem Fall ist die Haftung auf den typischerweise vorhersehbaren Schaden begrenzt.\n\n8.3. Eine Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit gesetzlich zulässig.\n\n8.4. Insbesondere haftet die Schule nicht für:\n\nVerletzungen oder Schäden, die durch Zuwiderhandlung gegen Anweisungen, Regeln oder Sicherheitsvorgaben oder durch den Körperkontakt im Kampftraining entstehen;\n\nSchäden, die durch eigenes fahrlässiges Verhalten des Mitglieds verursacht werden;\n\nSchäden an mitgebrachten Gegenständen oder Wertgegenständen (z. B. Kleidung, Schmuck, elektronische Geräte), sofern nicht grobe Fahrlässigkeit oder Vorsatz vorliegt.\n\n8.5. Der Teilnehmende ist verpflichtet, eigene Unfall- und Haftpflichtversicherung zu haben, soweit möglich, und ggf. Schädenmeldungspflichten zu erfüllen.\n\n9. Aussetzung und Ersatztraining\n\n9.1. Die Schule kann aufgrund von Betriebsstörungen, behördlichen Anordnungen, außergewöhnlichen Ereignissen (z. B. Unwetter, Pandemien), Krankheit von Trainern oder aus anderen wichtigen Gründen den Trainingsbetrieb ganz oder teilweise unterbrechen.\n\n9.2. In solchen Fällen kann die Schule nach Möglichkeit Ersatztermine oder alternative Angebote anbieten oder eine anteilige Gutschrift bzw. Beitragsminderung gewähren.\n\n9.3. Der Anspruch auf Ersatzleistung erlischt, wenn das Mitglied die Ersatzangebote nicht innerhalb einer angemessenen Frist in Anspruch nimmt, ohne ein berechtigtes Hindernis geltend zu machen.\n\n10. Widerrufsrecht für Verbraucher\n\n10.1. Sofern ein Vertrag online oder außerhalb von Geschäftsräumen mit einem Verbraucher geschlossen wird, steht dem Verbraucher ein gesetzliches Widerrufsrecht zu (vgl. §§ 312g, 355 BGB).\n\n10.2. Die Widerrufsbelehrung und die Bedingungen zum Widerruf sind im Vertrag bzw. in der Auftragsbestätigung getrennt darzustellen.\n\n10.3. Das Widerrufsrecht entfällt vollständig bei Verträgen zur Erbringung von Dienstleistungen (z. B. Trainingsleistungen, Mitgliedschaften, Kurse), wenn der Vertrag für eine bestimmte Zeit abgeschlossen ist und die Ausführung der Dienstleistung mit Zustimmung des Verbrauchers beginnt und der Verbraucher seine Kenntnis bestätigt, dass er mit Beginn der Vertragserfüllung sein Widerrufsrecht verliert.\n\n11. Datenschutz\n\n11.1. Die Schule erhebt, verarbeitet und nutzt personenbezogene Daten der Mitglieder nur, soweit dies zur Durchführung des Vertrags nötig ist, gesetzlich erlaubt oder vom Mitglied ausdrücklich genehmigt ist.\n\n11.2. Nähere Einzelheiten zur Datenverarbeitung, Zweckbindung, Speicherung und Rechte der Betroffenen ergeben sich aus der gesonderten Datenschutzinformation / Datenschutzrichtlinie der Schule.\n\n12. Schlussbestimmungen, Salvatorische Klausel, Gerichtsstand, anwendbares Recht\n\n12.1. Sollten einzelne Bestimmungen dieser AGB unwirksam oder undurchführbar sein oder werden, bleibt die Gültigkeit der übrigen Bestimmungen unberührt. Die Parteien verpflichten sich, die unwirksame Regelung durch eine solche wirksame zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen möglichst nahekommt.\n\n12.2. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.\n\n12.3. Soweit gesetzlich zulässig und der Teilnehmende Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist, ist ausschließlicher Gerichtsstand der Sitz der Schule (Vilsbiburg). Andernfalls gelten die gesetzlichen Gerichtsstände.\n\n12.4. Änderungen oder Ergänzungen des Vertrags, einschließlich dieser Klausel, bedürfen der Schriftform.',NULL,NULL,'',3,12,14,NULL,1,0,'','','','','','','','',0,'','','','',0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,5.00,10.00,'',NULL,'#DAA520','de','Europe/Berlin','EUR',NULL,'',500,20,50,1,1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-19 06:34:23','2025-11-16 07:46:58',NULL,'1.0','stripe_datev','sk_test_example','pk_test_example','datev_test_key','12345','123','','','','','','kleinunternehmer',0.00,22000.00,0.00,0.00,2025,0,0,1,0,NULL,'#FFD700','','','2025-11-16 08:46:58','default',''),(3,'Kampfsportschule Schreiner','Stephanie Schreiner','Ohmstr. ','14','84137','Vilsbbiburg','015752461776','','info@tda-vib.de','https://www.tda-vib.de','','',NULL,0,'Deutschland','','','','',NULL,NULL,'',NULL,0,0,0,NULL,'Verein','','','',NULL,'','','',NULL,NULL,NULL,NULL,'',NULL,'','','','','',0,'',NULL,NULL,'',NULL,'','',NULL,NULL,'',3,12,14,NULL,1,0,NULL,NULL,NULL,'','','',NULL,'',0,'','Karate','','',0,0,0,45.00,25.00,NULL,NULL,NULL,NULL,5.00,10.00,'',NULL,'#DAA520','de','Europe/Berlin','EUR',NULL,NULL,500,20,50,1,1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-19 06:34:23','2025-10-23 15:34:57',NULL,'1.0','manual_sepa',NULL,NULL,NULL,NULL,NULL,'','','','','','kleinunternehmer',0.00,22000.00,0.00,0.00,2025,0,0,1,0,NULL,'#FFD700','','','2025-10-23 17:34:57','default',NULL);
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
  `bank_name` varchar(100) NOT NULL,
  `bank_typ` enum('bank','stripe','paypal','sonstige') DEFAULT 'bank',
  `ist_aktiv` tinyint(1) DEFAULT '1',
  `ist_standard` tinyint(1) DEFAULT '0',
  `iban` varchar(34) DEFAULT NULL,
  `bic` varchar(11) DEFAULT NULL,
  `kontoinhaber` varchar(200) DEFAULT NULL,
  `sepa_glaeubiger_id` varchar(35) DEFAULT NULL,
  `stripe_publishable_key` varchar(255) DEFAULT NULL,
  `stripe_secret_key` varchar(255) DEFAULT NULL,
  `stripe_account_id` varchar(100) DEFAULT NULL,
  `paypal_email` varchar(255) DEFAULT NULL,
  `paypal_client_id` varchar(255) DEFAULT NULL,
  `paypal_client_secret` varchar(255) DEFAULT NULL,
  `api_key` varchar(255) DEFAULT NULL,
  `api_secret` varchar(255) DEFAULT NULL,
  `merchant_id` varchar(100) DEFAULT NULL,
  `notizen` text,
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
INSERT INTO `dojo_banken` VALUES (1,2,'Sparkasse velden','bank',1,0,'DE89370400440532013000','COBADEFFXXX','Tiger & Dragon Dojo e.V.','DE98ZZZ09999999999',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Hauptgeschäftskonto für laufende Beiträge und Ausgaben',0,'2025-10-12 08:36:23','2025-10-12 10:43:21'),(2,2,'Volksbank Stuttgart','bank',1,1,'DE89370400440532099988','VOBADESS','Tiger & Dragon Dojo e.V.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Rücklagenkonto für größere Investitionen',1,'2025-10-12 08:36:23','2025-10-12 08:42:30'),(3,2,'Stripe','stripe',1,0,NULL,NULL,NULL,NULL,'pk_test_51JxYZ0123456789abcdefghijklmnopqrstuvwxyz','sk_test_51JxYZ9876543210zyxwvutsrqponmlkjihgfedcba','acct_1234567890ABCDEF',NULL,NULL,NULL,NULL,NULL,NULL,'Online-Zahlungen für Kursbuchungen und Shop',2,'2025-10-12 08:36:23','2025-10-12 08:36:23'),(4,2,'PayPal Business','paypal',1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'business@tigerdragondojo.de','AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq123456789','ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKkJj987654321',NULL,NULL,NULL,'Alternative Online-Zahlungsmethode für internationale Mitglieder',3,'2025-10-12 08:36:23','2025-10-12 08:36:23'),(6,2,'Commerzbank Events','bank',1,0,'DE88100400000123456789','COBADEFFXXX','Tiger & Dragon Dojo e.V.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Spezialkonto für Turniere und Veranstaltungen',5,'2025-10-12 08:36:23','2025-10-12 08:36:23'),(7,3,'Stripe','stripe',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2025-10-25 05:58:22','2025-10-25 05:58:22'),(8,3,'Stripe','stripe',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2025-10-25 05:58:22','2025-10-25 05:58:22'),(9,3,'PayPal','paypal',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-10-25 05:58:22','2025-10-25 05:58:22'),(10,3,'PayPal','paypal',0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2025-10-25 05:58:22','2025-10-25 05:58:22');
/*!40000 ALTER TABLE `dojo_banken` ENABLE KEYS */;
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
  `template_config` json DEFAULT NULL COMMENT 'Template-Konfiguration (Layout, Spalten, etc.)',
  `ist_standard` tinyint(1) DEFAULT '0',
  `aktiv` tinyint(1) DEFAULT '1',
  `erstellt_am` datetime DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_typ` (`typ`),
  KEY `idx_ist_standard` (`ist_standard`)
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
  `parameter` json DEFAULT NULL COMMENT 'Generierungs-Parameter als JSON',
  `status` enum('erstellt','archiviert','geloescht') COLLATE utf8mb4_unicode_ci DEFAULT 'erstellt',
  `downloads` int DEFAULT '0' COMMENT 'Anzahl der Downloads',
  `letzter_download` datetime DEFAULT NULL,
  `gueltig_bis` date DEFAULT NULL COMMENT 'Optional: Ablaufdatum',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`id`),
  KEY `idx_typ` (`typ`),
  KEY `idx_erstellt_am` (`erstellt_am`),
  KEY `idx_status` (`status`),
  KEY `idx_dokumente_dojo_id` (`dojo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Speichert alle generierten PDF-Dokumente und Berichte';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dokumente`
--

LOCK TABLES `dokumente` WRITE;
/*!40000 ALTER TABLE `dokumente` DISABLE KEYS */;
/*!40000 ALTER TABLE `dokumente` ENABLE KEYS */;
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
  `variables` json DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_category` (`category`),
  KEY `idx_active` (`is_active`)
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
  `ereignis_typ` varchar(50) DEFAULT NULL,
  `titel` varchar(255) DEFAULT NULL,
  `beschreibung` text,
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
-- Table structure for table `finanzaemter`
--

DROP TABLE IF EXISTS `finanzaemter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finanzaemter` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `ort` varchar(255) NOT NULL,
  `bundesland` varchar(100) NOT NULL,
  `plz` varchar(10) DEFAULT NULL,
  `strasse` varchar(255) DEFAULT NULL,
  `telefon` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `finanzamtnummer` varchar(20) DEFAULT NULL,
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
  `name` varchar(100) NOT NULL,
  `beschreibung` text,
  `icon` varchar(50) DEFAULT 'target',
  `farbe_hex` varchar(7) DEFAULT '#ffd700',
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
  `alter_status` varchar(50) DEFAULT NULL,
  `neuer_status` varchar(50) DEFAULT NULL,
  `notiz` text,
  `trainer_feedback` text,
  `aktualisiert_von` int DEFAULT NULL,
  `aktualisiert_von_name` varchar(100) DEFAULT NULL,
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
  `typ` enum('externe Person','Mitglied') NOT NULL,
  `name` varchar(100) NOT NULL,
  `adresse` varchar(255) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
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
  `name` varchar(50) NOT NULL COMMENT 'Name der Graduierung (z.B. Weißgurt, Schwarzgurt)',
  `reihenfolge` int NOT NULL COMMENT 'Reihenfolge der Graduierung (1 = niedrigste)',
  `trainingsstunden_min` int DEFAULT '40' COMMENT 'Mindest-Trainingsstunden für diese Graduierung',
  `mindestzeit_monate` int DEFAULT '3' COMMENT 'Mindestzeit in Monaten bis zur nächsten Prüfung',
  `farbe_hex` varchar(7) DEFAULT '#FFFFFF' COMMENT 'Farbe der Graduierung als HEX-Code',
  `farbe_sekundaer` varchar(7) DEFAULT NULL,
  `aktiv` tinyint(1) DEFAULT '1' COMMENT 'Ist die Graduierung aktiv?',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `kategorie` varchar(50) DEFAULT NULL,
  `dan_grad` int DEFAULT NULL,
  PRIMARY KEY (`graduierung_id`),
  UNIQUE KEY `uk_stil_reihenfolge` (`stil_id`,`reihenfolge`),
  UNIQUE KEY `uk_stil_name` (`stil_id`,`name`),
  KEY `idx_graduierung_stil` (`stil_id`),
  KEY `idx_graduierung_aktiv` (`aktiv`),
  KEY `idx_graduierung_reihenfolge` (`reihenfolge`),
  CONSTRAINT `graduierungen_ibfk_1` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gürtel-Graduierungen pro Kampfkunst-Stil';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `graduierungen`
--

LOCK TABLES `graduierungen` WRITE;
/*!40000 ALTER TABLE `graduierungen` DISABLE KEYS */;
INSERT INTO `graduierungen` VALUES (23,7,'Weißgurt',1,0,0,'#FFFFFF',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(24,7,'Gelbgurt',2,45,3,'#FFD700',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09','grundstufe',NULL),(25,7,'Grüngurt',3,65,5,'#32CD32',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(26,7,'Blaugurt',4,85,8,'#0066CC',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(27,7,'Rotgurt',5,105,12,'#DC143C',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(28,7,'Schwarzgurt 1. Dan',7,150,18,'#000000',NULL,1,'2025-08-25 05:15:37','2025-09-05 06:39:09',NULL,NULL),(29,3,'Weißgurt',1,0,0,'#FFFFFF',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(30,3,'Blaugurt',2,100,12,'#0066CC',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(31,3,'Lila Gurt',3,200,24,'#8A2BE2',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(32,3,'Braungurt',4,300,36,'#8B4513',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(33,3,'Schwarzgurt',5,500,60,'#000000',NULL,1,'2025-08-25 05:15:37','2025-10-25 14:39:14',NULL,NULL),(34,4,'Anfänger',1,0,0,'#FFFFFF',NULL,1,'2025-08-25 05:16:09','2025-08-25 05:16:09',NULL,NULL),(35,4,'Fortgeschritten',2,50,6,'#FFD700',NULL,1,'2025-08-25 05:16:09','2025-08-25 05:16:09',NULL,NULL),(36,4,'Wettkampf',3,100,12,'#FF6B35',NULL,1,'2025-08-25 05:16:09','2025-08-25 05:16:09',NULL,NULL),(47,5,'Weißgurt',1,0,0,'#FFFFFF',NULL,1,'2025-08-25 05:17:18','2025-11-08 10:40:41',NULL,NULL),(48,5,'Gelbgurt',3,40,3,'#FFD700',NULL,1,'2025-08-25 05:17:18','2025-11-08 10:40:41',NULL,NULL),(50,5,'Grüngurt',5,60,6,'#32CD32',NULL,1,'2025-08-25 05:17:18','2025-11-08 10:40:41',NULL,NULL),(51,5,'Schwarzgurt',10,150,18,'#000000',NULL,1,'2025-08-25 05:17:18','2025-11-08 10:40:41',NULL,NULL),(57,4,'Blaugurt',4,40,3,'#0066CC',NULL,1,'2025-08-27 05:15:08','2025-08-27 05:15:08',NULL,NULL),(58,4,'Orangegurt',5,40,3,'#FF8C00',NULL,1,'2025-08-27 18:22:28','2025-08-27 18:22:28','grundstufe',NULL),(59,4,'Gelb-Orangegurt',6,40,3,'#FFD700','#FF8C00',1,'2025-08-27 18:45:08','2025-08-27 18:45:08','grundstufe',NULL),(61,7,'Rot-Schwarzgurt',6,40,3,'#DC143C','#000000',1,'2025-09-01 15:08:37','2025-09-05 06:39:09','oberstufe',NULL),(62,5,'Blau-Braungurt',8,40,3,'#0066CC','#8B4513',1,'2025-09-04 11:58:27','2025-11-08 10:40:41','oberstufe',NULL),(63,5,'Weiß-Gelbgurt',2,40,3,'#FFFFFF','#FFD700',1,'2025-09-07 08:52:43','2025-11-08 10:40:41','grundstufe',NULL),(64,5,'Blaugurt',7,40,3,'#0066CC',NULL,1,'2025-10-25 17:26:34','2025-11-08 10:40:41','mittelstufe',NULL),(65,5,'Rot-Schwarzgurt',9,40,3,'#DC143C','#000000',1,'2025-10-25 17:27:41','2025-11-08 10:40:41','oberstufe',NULL),(67,5,'Gelb - Grüngurt',4,40,3,'#FFD700','#0A9913',1,'2025-11-08 09:54:56','2025-11-08 10:40:41',NULL,NULL),(68,5,'Grün-Blaugurt',6,40,3,'#32CD32','#1C2DB0',1,'2025-11-08 10:40:17','2025-11-08 10:40:41',NULL,NULL);
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
  `name` varchar(50) NOT NULL,
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`gruppen_id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_gruppen_dojo_id` (`dojo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gruppen`
--

LOCK TABLES `gruppen` WRITE;
/*!40000 ALTER TABLE `gruppen` DISABLE KEYS */;
INSERT INTO `gruppen` VALUES (1,'Kinder 4-6 Jahre',1),(2,'Kinder 7-12',1),(3,'Jugendliche 13-17',1),(4,'Erwachsene',1),(5,'test',1);
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
-- Table structure for table `inventar`
--

DROP TABLE IF EXISTS `inventar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `kategorie` varchar(50) DEFAULT NULL,
  `zustand` varchar(20) DEFAULT 'neu',
  `standort` varchar(255) DEFAULT NULL,
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
  `gruppenname` varchar(50) NOT NULL,
  `stil` varchar(50) DEFAULT NULL,
  `trainer_id` int DEFAULT NULL,
  `trainer_ids` json DEFAULT NULL,
  `trainingszeit` time DEFAULT NULL,
  `beginn` time DEFAULT NULL,
  `ende` time DEFAULT NULL,
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  PRIMARY KEY (`kurs_id`),
  KEY `trainer_id` (`trainer_id`),
  KEY `idx_kurse_dojo_id` (`dojo_id`),
  CONSTRAINT `kurse_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `trainer` (`trainer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kurse`
--

LOCK TABLES `kurse` WRITE;
/*!40000 ALTER TABLE `kurse` DISABLE KEYS */;
INSERT INTO `kurse` VALUES (7,'Erwachsene','BJJ',3,'[3, 2]',NULL,'00:00:00','00:00:00',1),(9,'Erwachsene','Enso Karate',2,'[2]',NULL,NULL,NULL,1),(10,'Kinder 4-6 Jahre','Karate',2,'[2, 3, 4]',NULL,NULL,NULL,1),(11,'Kinder 7-12','Karate',2,'[2]',NULL,NULL,NULL,1),(12,'Erwachsene','Kickboxen',2,'[2]',NULL,NULL,NULL,1),(13,'Erwachsene','ShieldX',2,'[2]',NULL,NULL,NULL,1),(14,'Kinder 4-6 Jahre','ShieldX',2,'[2]',NULL,NULL,NULL,1),(15,'Erwachsene','Enso Karate',NULL,'[2, 3]',NULL,NULL,NULL,1);
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lager_bewegungen`
--

LOCK TABLES `lager_bewegungen` WRITE;
/*!40000 ALTER TABLE `lager_bewegungen` DISABLE KEYS */;
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
  `name` varchar(50) NOT NULL,
  `monate` int NOT NULL,
  `beschreibung` text,
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
-- Temporary view structure for view `mitglied_fortschritt_overview`
--

DROP TABLE IF EXISTS `mitglied_fortschritt_overview`;
/*!50001 DROP VIEW IF EXISTS `mitglied_fortschritt_overview`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `mitglied_fortschritt_overview` AS SELECT 
 1 AS `mitglied_id`,
 1 AS `mitglied_name`,
 1 AS `gesamt_skills`,
 1 AS `gemeisterte_skills`,
 1 AS `durchschnitt_fortschritt`,
 1 AS `aktive_ziele`,
 1 AS `erreichte_meilensteine`*/;
SET character_set_client = @saved_cs_client;

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
  `anmerkungen` text,
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mitglied_stil` (`mitglied_id`,`stil_id`),
  KEY `stil_id` (`stil_id`),
  KEY `current_graduierung_id` (`current_graduierung_id`),
  CONSTRAINT `mitglied_stil_data_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`),
  CONSTRAINT `mitglied_stil_data_ibfk_2` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`),
  CONSTRAINT `mitglied_stil_data_ibfk_3` FOREIGN KEY (`current_graduierung_id`) REFERENCES `graduierungen` (`graduierung_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglied_stil_data`
--

LOCK TABLES `mitglied_stil_data` WRITE;
/*!40000 ALTER TABLE `mitglied_stil_data` DISABLE KEYS */;
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
  `stil` enum('Kickboxen','Karate','Taekwon-Do','ShieldX','BJJ') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `mitglied_id` (`mitglied_id`),
  CONSTRAINT `mitglied_stile_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglied_stile`
--

LOCK TABLES `mitglied_stile` WRITE;
/*!40000 ALTER TABLE `mitglied_stile` DISABLE KEYS */;
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
  `iban` varchar(34) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bic` varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bankname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kontoinhaber` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zahlungsmethode` enum('Lastschrift','Bar','Überweisung') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Lastschrift',
  `zahllaufgruppe` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `eintrittsdatum` date NOT NULL DEFAULT (curdate()),
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
  PRIMARY KEY (`mitglied_id`),
  KEY `idx_mitglied_stil` (`stil_id`),
  KEY `idx_mitglied_graduierung` (`graduierung_id`),
  KEY `idx_mitglieder_aktiv` (`aktiv`),
  KEY `idx_mitglieder_name` (`nachname`,`vorname`),
  KEY `idx_mitglieder_dojo_id` (`dojo_id`),
  KEY `idx_mitglieder_foto` (`foto_pfad`),
  KEY `idx_mitglieder_geworben_von` (`geworben_von_mitglied_id`),
  CONSTRAINT `fk_mitglied_graduierung` FOREIGN KEY (`graduierung_id`) REFERENCES `graduierungen` (`graduierung_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mitglied_stil` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitglieder`
--

LOCK TABLES `mitglieder` WRITE;
/*!40000 ALTER TABLE `mitglieder` DISABLE KEYS */;
/*!40000 ALTER TABLE `mitglieder` ENABLE KEYS */;
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
  `skill_name` varchar(200) NOT NULL,
  `beschreibung` text,
  `fortschritt_prozent` int DEFAULT '0',
  `status` enum('nicht_gestartet','in_arbeit','gemeistert','auf_eis') DEFAULT 'nicht_gestartet',
  `prioritaet` enum('niedrig','mittel','hoch','kritisch') DEFAULT 'mittel',
  `schwierigkeit` enum('anfaenger','fortgeschritten','experte','meister') DEFAULT 'anfaenger',
  `gestartet_am` date DEFAULT NULL,
  `gemeistert_am` date DEFAULT NULL,
  `ziel_datum` date DEFAULT NULL,
  `trainer_bewertung` int DEFAULT NULL,
  `trainer_kommentar` text,
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
  `titel` varchar(200) NOT NULL,
  `beschreibung` text,
  `typ` enum('pruefung','turnier','achievement','persoenlich','sonstiges') DEFAULT 'achievement',
  `erreicht` tinyint(1) DEFAULT '0',
  `erreicht_am` date DEFAULT NULL,
  `ziel_datum` date DEFAULT NULL,
  `belohnung` varchar(200) DEFAULT NULL,
  `auszeichnung_bild_url` varchar(500) DEFAULT NULL,
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
  `titel` varchar(200) NOT NULL,
  `beschreibung` text,
  `start_datum` date NOT NULL,
  `ziel_datum` date NOT NULL,
  `status` enum('aktiv','erreicht','verfehlt','abgebrochen') DEFAULT 'aktiv',
  `fortschritt_prozent` int DEFAULT '0',
  `messbar` tinyint(1) DEFAULT '0',
  `einheit` varchar(50) DEFAULT NULL,
  `ziel_wert` decimal(10,2) DEFAULT NULL,
  `aktueller_wert` decimal(10,2) DEFAULT '0.00',
  `prioritaet` enum('niedrig','mittel','hoch') DEFAULT 'mittel',
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
  `betreff` varchar(255) DEFAULT NULL,
  `nachricht` text,
  `status` varchar(20) DEFAULT 'entwurf',
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
  `preferences` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`)
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
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_scheduled_at` (`scheduled_at`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`)
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
  `email_config` json DEFAULT NULL,
  `push_config` json DEFAULT NULL,
  `default_from_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_from_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Dojo Software',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_settings`
--

LOCK TABLES `notification_settings` WRITE;
/*!40000 ALTER TABLE `notification_settings` DISABLE KEYS */;
INSERT INTO `notification_settings` VALUES (1,0,0,'{\"smtp_host\": \"\", \"smtp_port\": 587, \"smtp_user\": \"\", \"smtp_secure\": false, \"smtp_password\": \"\"}','{}','','Dojo Software','2025-10-15 10:42:12','2025-10-15 10:43:42');
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
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_recipient` (`recipient`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,'push','test@example.com','Test','Test message','sent',NULL,NULL,NULL,'2025-10-15 13:24:07',NULL,NULL),(2,'push','admin@dojo.local','xcvx','xcvxvx','sent',NULL,NULL,NULL,'2025-10-15 13:24:31',NULL,NULL),(3,'push','admin@dojo.local','sds','dsfsdfds','sent',NULL,NULL,NULL,'2025-10-15 13:36:49',NULL,NULL),(4,'push','alexander.krause@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(5,'push','amelie.heinrich@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(6,'push','anna@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(7,'push','anna.schmidt@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(8,'push','ben.becker@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(9,'push','clara.lorenz@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(10,'push','daniel.ludwig@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(11,'push','david.stein@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(12,'push','elias.schwarz@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(13,'push','emily.richter@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(14,'push','emma.wagner@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(15,'push','erik.vogel@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(16,'push','eva.scholz@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(17,'push','fabian.kaiser@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(18,'push','finn.schaefer@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(19,'push','florian.albrecht@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(20,'push','hannah.guenther@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(21,'push','jan.krueger@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(22,'push','johanna.franke@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(23,'push','jonas.bauer@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(24,'push','julia.keller@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(25,'push','julian.boehme@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(26,'push','katharina.winter@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(27,'push','kevin.otto@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(28,'push','laura.hoffmann@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(29,'push','lea.wolf@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(30,'push','lena.berger@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(31,'push','leon.koch@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(32,'push','leonie.graf@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(33,'push','lisa.jung@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(34,'push','lukas.mueller@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(35,'push','mara.walter@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(36,'push','marie.zimmermann@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(37,'push','markus.maier@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(38,'push','max.mustermann@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(39,'push','max.mustermann@test.de','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(40,'push','mitglied@test.de','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(41,'push','mia.fischer@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(42,'push','michael.seidel@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(43,'push','mila.friedrich@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(44,'push','mira.hahn@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(45,'push','nina.hartmann@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(46,'push','noah.meier@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(47,'push','nora.simon@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(48,'push','paul.weber@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(49,'push','philipp.neumann@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(50,'push','pia.pfeiffer@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(51,'push','sarah.klein@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(52,'push','sebastian.lang@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(53,'push','sophie.lehmann@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(54,'push','tim.braun@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(55,'push','tobias.gross@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(56,'push','tom.schubert@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(57,'push','tom@example.com','dsfdsf','sdfdsf','sent',NULL,NULL,NULL,'2025-10-15 13:38:09',NULL,NULL),(58,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif ID:</strong> 1<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 19:57:47\n    ','read',NULL,NULL,NULL,'2025-11-13 18:57:47',NULL,NULL),(59,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif ID:</strong> 1<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 19:57:50\n    ','read',NULL,NULL,NULL,'2025-11-13 18:57:50',NULL,NULL),(60,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif ID:</strong> 1<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 19:57:51\n    ','read',NULL,NULL,NULL,'2025-11-13 18:57:51',NULL,NULL),(61,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif ID:</strong> 1<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 19:57:52\n    ','read',NULL,NULL,NULL,'2025-11-13 18:57:52',NULL,NULL),(62,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif ID:</strong> 1<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 19:57:54\n    ','read',NULL,NULL,NULL,'2025-11-13 18:57:54',NULL,NULL),(63,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif ID:</strong> 1<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 19:57:55\n    ','read',NULL,NULL,NULL,'2025-11-13 18:57:55',NULL,NULL),(64,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif ID:</strong> 1<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 19:57:55\n    ','read',NULL,NULL,NULL,'2025-11-13 18:57:55',NULL,NULL),(65,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif:</strong> Premium Mitgliedschaft - 49.90€ / 12 Monate<br>\n      <strong>Zahlungszyklus:</strong> monatlich<br>\n      <strong>Zahlungsmethode:</strong> lastschrift<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 20:37:49\n    ','read',NULL,NULL,NULL,'2025-11-13 19:37:49',NULL,NULL),(66,'admin_alert','admin','Neue Mitglieder-Registrierung','\n      <strong>Neues Mitglied registriert!</strong><br><br>\n      <strong>Name:</strong> Max Mustermann<br>\n      <strong>Email:</strong> max.mustermann@test.de<br>\n      <strong>Geburtsdatum:</strong> 15.05.1990<br>\n      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>\n      <strong>Telefon:</strong> 0123-456789<br>\n      <strong>Tarif:</strong> Premium Mitgliedschaft - 49.90€ / 12 Monate<br>\n      <strong>Zahlungszyklus:</strong> monatlich<br>\n      <strong>Zahlungsmethode:</strong> lastschrift<br>\n      <strong>Vertragsbeginn:</strong> 01.01.2025<br>\n      <strong>Registrierungsdatum:</strong> 13.11.2025, 20:42:18\n    ','read',NULL,NULL,NULL,'2025-11-13 19:42:18',NULL,NULL);
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
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
  `provider` enum('manual_sepa','stripe_datev') NOT NULL,
  `action` varchar(100) NOT NULL COMMENT 'create_payment, export_datev, etc.',
  `status` enum('success','error','warning') NOT NULL,
  `message` text,
  `data` json DEFAULT NULL COMMENT 'Request/Response Daten',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `dojo_id` (`dojo_id`),
  KEY `mitglied_id` (`mitglied_id`),
  KEY `idx_provider_action` (`provider`,`action`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`),
  CONSTRAINT `payment_provider_logs_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_provider_logs_ibfk_2` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE SET NULL
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
-- Temporary view structure for view `payment_status_overview`
--

DROP TABLE IF EXISTS `payment_status_overview`;
/*!50001 DROP VIEW IF EXISTS `payment_status_overview`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `payment_status_overview` AS SELECT 
 1 AS `mitglied_id`,
 1 AS `vorname`,
 1 AS `nachname`,
 1 AS `payment_provider`,
 1 AS `active_payment_methods`,
 1 AS `payment_system_name`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `personal`
--

DROP TABLE IF EXISTS `personal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal` (
  `personal_id` int NOT NULL AUTO_INCREMENT,
  `personalnummer` varchar(20) NOT NULL,
  `vorname` varchar(100) NOT NULL,
  `nachname` varchar(100) NOT NULL,
  `titel` varchar(50) DEFAULT NULL,
  `geburtsdatum` date DEFAULT NULL,
  `geschlecht` enum('m','w','d') DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `telefon` varchar(50) DEFAULT NULL,
  `handy` varchar(50) DEFAULT NULL,
  `strasse` varchar(255) DEFAULT NULL,
  `hausnummer` varchar(20) DEFAULT NULL,
  `plz` varchar(10) DEFAULT NULL,
  `ort` varchar(100) DEFAULT NULL,
  `land` varchar(100) DEFAULT 'Deutschland',
  `position` varchar(100) NOT NULL,
  `abteilung` varchar(100) DEFAULT NULL,
  `einstellungsdatum` date NOT NULL,
  `kuendigungsdatum` date DEFAULT NULL,
  `beschaeftigungsart` enum('Vollzeit','Teilzeit','Minijob','Praktikant','Freelancer') NOT NULL,
  `arbeitszeit_stunden` decimal(4,2) DEFAULT NULL,
  `grundgehalt` decimal(10,2) DEFAULT NULL,
  `stundenlohn` decimal(6,2) DEFAULT NULL,
  `waehrung` varchar(3) DEFAULT 'EUR',
  `ausbildung` varchar(500) DEFAULT NULL,
  `zertifikate` text,
  `kampfkunst_graduierung` varchar(100) DEFAULT NULL,
  `staatsangehoerigkeit` varchar(100) DEFAULT NULL,
  `arbeitserlaubnis` tinyint(1) DEFAULT '1',
  `sozialversicherungsnummer` varchar(50) DEFAULT NULL,
  `steuerklasse` enum('I','II','III','IV','V','VI') DEFAULT NULL,
  `iban` varchar(50) DEFAULT NULL,
  `bic` varchar(20) DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `status` enum('aktiv','inaktiv','gekuendigt','beurlaubt') DEFAULT 'aktiv',
  `notizen` text,
  `foto_pfad` varchar(500) DEFAULT NULL,
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
  `notizen` varchar(500) DEFAULT NULL,
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
  `berechtigung` varchar(100) NOT NULL,
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
  `bemerkung` text,
  `status` enum('eingecheckt','ausgecheckt') DEFAULT 'eingecheckt',
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
  `typ` enum('Urlaub','Krankheit','Fortbildung','Sonderurlaub','Unbezahlt') NOT NULL,
  `start_datum` date NOT NULL,
  `end_datum` date NOT NULL,
  `tage_gesamt` int DEFAULT NULL,
  `grund` varchar(255) DEFAULT NULL,
  `status` enum('beantragt','genehmigt','abgelehnt','storniert') DEFAULT 'beantragt',
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
  `pruefungsinhalte` json DEFAULT NULL COMMENT 'Detaillierte Prüfungsinhalte als JSON',
  `einzelbewertungen` json DEFAULT NULL COMMENT 'Einzelbewertungen als JSON (Kata, Kumite, etc.)',
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
  CONSTRAINT `pruefungen_ibfk_2` FOREIGN KEY (`stil_id`) REFERENCES `stile` (`stil_id`) ON DELETE RESTRICT,
  CONSTRAINT `pruefungen_ibfk_3` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `pruefungen_ibfk_4` FOREIGN KEY (`graduierung_vorher_id`) REFERENCES `graduierungen` (`graduierung_id`) ON DELETE SET NULL,
  CONSTRAINT `pruefungen_ibfk_5` FOREIGN KEY (`graduierung_nachher_id`) REFERENCES `graduierungen` (`graduierung_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Erweiterte Prüfungsverwaltung mit Graduierungen';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefungen`
--

LOCK TABLES `pruefungen` WRITE;
/*!40000 ALTER TABLE `pruefungen` DISABLE KEYS */;
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
  `kategorie` varchar(50) NOT NULL COMMENT 'Kategorie (Grundtechniken, Kata, Kumite, etc.)',
  `titel` varchar(100) NOT NULL COMMENT 'Titel des Prüfungsinhalts',
  `beschreibung` text COMMENT 'Detaillierte Beschreibung',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Prüfungsinhalte pro Graduierung';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefungsinhalte`
--

LOCK TABLES `pruefungsinhalte` WRITE;
/*!40000 ALTER TABLE `pruefungsinhalte` DISABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pruefungstermin_vorlagen`
--

LOCK TABLES `pruefungstermin_vorlagen` WRITE;
/*!40000 ALTER TABLE `pruefungstermin_vorlagen` DISABLE KEYS */;
INSERT INTO `pruefungstermin_vorlagen` VALUES (1,'2025-10-20','10:00:00',NULL,NULL,5,NULL,NULL,NULL,NULL,2,'2025-10-28 20:17:31','2025-10-28 20:17:31'),(2,'2025-10-29','10:00:00',NULL,NULL,5,NULL,NULL,NULL,NULL,2,'2025-10-28 20:18:25','2025-10-28 20:18:25'),(3,'2025-12-30','10:00:00',NULL,NULL,3,NULL,NULL,NULL,NULL,2,'2025-10-29 04:49:53','2025-10-29 04:49:53');
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
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
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
  `name` varchar(100) NOT NULL,
  `beschreibung` text,
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
  KEY `idx_raeume_reihenfolge` (`reihenfolge`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `raeume`
--

LOCK TABLES `raeume` WRITE;
/*!40000 ALTER TABLE `raeume` DISABLE KEYS */;
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
  `faelligkeitsdatum` date NOT NULL,
  `betrag` decimal(10,2) NOT NULL,
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
  CONSTRAINT `rechnungen_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
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
  `mandatsreferenz` varchar(35) NOT NULL,
  `glaeubiger_id` varchar(35) NOT NULL DEFAULT 'DE98ZZZ09999999999',
  `erstellungsdatum` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('aktiv','widerrufen','abgelaufen') NOT NULL DEFAULT 'aktiv',
  `iban` varchar(34) NOT NULL,
  `bic` varchar(11) NOT NULL,
  `kontoinhaber` varchar(100) NOT NULL,
  `bankname` varchar(100) DEFAULT NULL,
  `mandat_typ` enum('CORE','COR1','B2B') NOT NULL DEFAULT 'CORE',
  `sequenz` enum('FRST','RCUR','OOFF','FNAL') NOT NULL DEFAULT 'FRST',
  `widerruf_datum` datetime DEFAULT NULL,
  `ablaufdatum` date DEFAULT NULL,
  `letzte_nutzung` datetime DEFAULT NULL,
  `ersteller_user_id` int DEFAULT NULL,
  `pdf_pfad` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archiviert` tinyint(1) DEFAULT '0',
  `archiviert_am` datetime DEFAULT NULL,
  `archiviert_grund` varchar(255) DEFAULT NULL,
  `provider` enum('manual_sepa','stripe_datev') DEFAULT 'manual_sepa' COMMENT 'Welches System das Mandat verwaltet',
  `stripe_setup_intent_id` varchar(255) DEFAULT NULL COMMENT 'Stripe Setup Intent f├╝r SEPA',
  `stripe_payment_method_id` varchar(255) DEFAULT NULL COMMENT 'Stripe Payment Method ID',
  PRIMARY KEY (`mandat_id`),
  UNIQUE KEY `mandatsreferenz` (`mandatsreferenz`),
  KEY `idx_mitglied` (`mitglied_id`),
  KEY `idx_status` (`status`),
  KEY `idx_mandatsreferenz` (`mandatsreferenz`),
  KEY `idx_provider` (`provider`),
  KEY `idx_stripe_payment_method` (`stripe_payment_method_id`),
  CONSTRAINT `sepa_mandate_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sepa_mandate`
--

LOCK TABLES `sepa_mandate` WRITE;
/*!40000 ALTER TABLE `sepa_mandate` DISABLE KEYS */;
/*!40000 ALTER TABLE `sepa_mandate` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stile`
--

DROP TABLE IF EXISTS `stile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stile` (
  `stil_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `beschreibung` text,
  `aktiv` tinyint(1) DEFAULT '1',
  `reihenfolge` int DEFAULT '0',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`stil_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stile`
--

LOCK TABLES `stile` WRITE;
/*!40000 ALTER TABLE `stile` DISABLE KEYS */;
INSERT INTO `stile` VALUES (2,'ShieldX','Moderne Selbstverteidigung mit realistischen Szenarien',1,5,'2025-08-25 05:11:38','2025-11-07 14:39:05'),(3,'BJJ','',0,1,'2025-08-25 05:11:38','2025-11-07 14:39:05'),(4,'Kickboxen','Moderne Kampfsportart kombiniert Boxing mit Fußtechniken',1,4,'2025-08-25 05:11:38','2025-11-07 14:39:05'),(5,'Enso Karate','Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken',1,2,'2025-08-25 05:11:38','2025-11-07 15:00:06'),(7,'Taekwon-Do','Koreanische Kampfkunst mit Betonung auf Fußtechniken und hohe Tritte',1,6,'2025-08-25 05:11:38','2025-11-07 14:39:05'),(8,'Brazilian Jiu-Jitsu','Brasilianisches Jiu-Jitsu - Bodenkampf und Grappling-Techniken',1,3,'2025-08-25 05:11:38','2025-11-07 15:00:06'),(18,'test','',0,7,'2025-09-08 16:21:04','2025-11-07 14:39:05');
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
  `stripe_payment_intent_id` varchar(255) NOT NULL COMMENT 'Stripe Payment Intent ID',
  `amount` int NOT NULL COMMENT 'Betrag in Cent',
  `currency` varchar(3) DEFAULT 'EUR',
  `status` enum('requires_payment_method','requires_confirmation','requires_action','processing','requires_capture','canceled','succeeded','failed') NOT NULL DEFAULT 'requires_payment_method',
  `mandate_reference` varchar(50) DEFAULT NULL COMMENT 'SEPA Mandatsreferenz f├╝r Stripe',
  `payment_method_id` varchar(255) DEFAULT NULL COMMENT 'Stripe Payment Method ID',
  `invoice_reference` varchar(100) DEFAULT NULL COMMENT 'Rechnungsreferenz',
  `description` text,
  `metadata` json DEFAULT NULL COMMENT 'Zus├ñtzliche Stripe Metadaten',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_payment_intent_id` (`stripe_payment_intent_id`),
  KEY `idx_stripe_payment_intent` (`stripe_payment_intent_id`),
  KEY `idx_mitglied_status` (`mitglied_id`,`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `stripe_payment_intents_ibfk_1` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE CASCADE
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
  `stripe_event_id` varchar(255) NOT NULL,
  `event_type` varchar(100) NOT NULL COMMENT 'payment_intent.succeeded, etc.',
  `processed` tinyint(1) DEFAULT '0',
  `payment_intent_id` int DEFAULT NULL,
  `webhook_data` json NOT NULL,
  `processing_error` text,
  `received_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_event_id` (`stripe_event_id`),
  KEY `payment_intent_id` (`payment_intent_id`),
  KEY `idx_event_id` (`stripe_event_id`),
  KEY `idx_processed` (`processed`),
  KEY `idx_event_type` (`event_type`),
  CONSTRAINT `stripe_webhooks_ibfk_1` FOREIGN KEY (`payment_intent_id`) REFERENCES `stripe_payment_intents` (`id`) ON DELETE SET NULL
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
  `tag` varchar(20) NOT NULL,
  `uhrzeit_start` time NOT NULL,
  `uhrzeit_ende` time NOT NULL,
  `kurs_id` int DEFAULT NULL,
  `trainer_id` int DEFAULT NULL,
  `raum_id` int DEFAULT NULL COMMENT 'Zugeordneter Raum für diesen Stundenplan-Eintrag',
  PRIMARY KEY (`stundenplan_id`),
  KEY `fk_stundenplan_kurs` (`kurs_id`),
  KEY `idx_stundenplan_raum` (`raum_id`),
  CONSTRAINT `fk_stundenplan_kurs` FOREIGN KEY (`kurs_id`) REFERENCES `kurse` (`kurs_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stundenplan_raum` FOREIGN KEY (`raum_id`) REFERENCES `raeume` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stundenplan`
--

LOCK TABLES `stundenplan` WRITE;
/*!40000 ALTER TABLE `stundenplan` DISABLE KEYS */;
INSERT INTO `stundenplan` VALUES (4,'Montag','17:15:00','17:45:00',10,2,NULL),(5,'Montag','17:45:00','18:30:00',11,2,NULL),(6,'Montag','18:30:00','19:30:00',12,2,NULL),(7,'Montag','19:30:00','20:30:00',13,2,NULL),(8,'Mittwoch','17:15:00','17:45:00',10,NULL,NULL),(9,'Mittwoch','17:45:00','18:30:00',11,NULL,NULL),(10,'Mittwoch','18:30:00','19:30:00',12,NULL,NULL),(11,'Donnerstag','18:00:00','18:45:00',12,NULL,NULL),(12,'Dienstag','19:00:00','20:00:00',9,NULL,NULL),(13,'Freitag','19:00:00','20:00:00',13,NULL,NULL),(14,'Samstag','20:00:00','21:00:00',10,NULL,NULL),(15,'Samstag','21:00:00','21:00:00',9,NULL,NULL),(16,'Sonntag','20:00:00','21:00:00',7,NULL,NULL),(17,'Dienstag','21:00:00','22:00:00',7,NULL,NULL),(18,'Montag','20:00:00','21:00:00',13,NULL,NULL);
/*!40000 ALTER TABLE `stundenplan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tarife`
--

DROP TABLE IF EXISTS `tarife`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tarife` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `price_cents` int NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'EUR',
  `duration_months` int NOT NULL,
  `billing_cycle` enum('MONTHLY','QUARTERLY','YEARLY') NOT NULL,
  `payment_method` set('SEPA','CARD','PAYPAL','BANK_TRANSFER') NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `altersgruppe` varchar(50) DEFAULT NULL,
  `mindestlaufzeit_monate` int DEFAULT NULL,
  `kuendigungsfrist_monate` int DEFAULT '3',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tarife`
--

LOCK TABLES `tarife` WRITE;
/*!40000 ALTER TABLE `tarife` DISABLE KEYS */;
INSERT INTO `tarife` VALUES (19,'Kinder & Jugendliche 3 Monate',7500,'EUR',3,'MONTHLY','SEPA',1,'Kinder & Jugendliche',3,3),(20,'Kinder & Jugendliche 6 Monate',6500,'EUR',6,'MONTHLY','SEPA',1,'Kinder & Jugendliche',6,3),(21,'Kinder & Jugendliche 12 Monate',4900,'EUR',12,'MONTHLY','SEPA',1,'Kinder & Jugendliche',12,3),(22,'Erwachsene 3 Monate',9500,'EUR',3,'MONTHLY','SEPA',1,'Erwachsene',3,3),(23,'Erwachsene 6 Monate',8500,'EUR',6,'MONTHLY','SEPA',1,'Erwachsene',6,3),(24,'Erwachsene 12 Monate',6900,'EUR',12,'MONTHLY','SEPA',1,'Erwachsene',12,3),(25,'Studenten & Schüler 3 Monate',7500,'EUR',3,'MONTHLY','SEPA',1,'Studenten & Schüler',3,3),(26,'Studenten & Schüler 6 Monate',6500,'EUR',6,'MONTHLY','SEPA',1,'Studenten & Schüler',6,3),(27,'Studenten & Schüler 12 Monate',4900,'EUR',12,'MONTHLY','SEPA',1,'Studenten & Schüler',12,3);
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
  `status` varchar(20) DEFAULT 'angemeldet',
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
  `titel` varchar(255) DEFAULT NULL,
  `typ` varchar(50) DEFAULT NULL,
  `start_datum` datetime DEFAULT NULL,
  `end_datum` datetime DEFAULT NULL,
  `status` varchar(20) DEFAULT 'geplant',
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
-- Temporary view structure for view `top_performer`
--

DROP TABLE IF EXISTS `top_performer`;
/*!50001 DROP VIEW IF EXISTS `top_performer`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `top_performer` AS SELECT 
 1 AS `mitglied_id`,
 1 AS `mitglied_name`,
 1 AS `gemeisterte_skills`,
 1 AS `durchschnitt_fortschritt`,
 1 AS `meilensteine`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `trainer`
--

DROP TABLE IF EXISTS `trainer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainer` (
  `trainer_id` int NOT NULL AUTO_INCREMENT,
  `vorname` varchar(50) NOT NULL,
  `nachname` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `telefon` varchar(25) DEFAULT NULL,
  `stil` enum('Kickboxen','Karate','ShieldX','BJJ') NOT NULL DEFAULT 'Kickboxen',
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
-- Table structure for table `trainer_stile`
--

DROP TABLE IF EXISTS `trainer_stile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainer_stile` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trainer_id` int NOT NULL,
  `stil` enum('Kickboxen','Karate','ShieldX','BJJ') NOT NULL,
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
  `titel` varchar(200) DEFAULT NULL,
  `notiz` text NOT NULL,
  `typ` enum('allgemein','staerke','schwaeche','verbesserung','verletzung','sonstiges') DEFAULT 'allgemein',
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
  `typ` varchar(50) DEFAULT NULL,
  `betrag` decimal(10,2) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'offen',
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
  `username` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) DEFAULT 'admin',
  `mitglied_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `security_question` varchar(255) DEFAULT NULL,
  `security_answer_hash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_mitglied_id` (`mitglied_id`),
  CONSTRAINT `fk_users_mitglied` FOREIGN KEY (`mitglied_id`) REFERENCES `mitglieder` (`mitglied_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@tda-intl.org','$2b$10$xeTdpRiwFw6yGFMXJM2VT.xSriFN4k7das8KdXMoNbplza8NbOOGa','admin',NULL,'2025-11-15 19:01:07',NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_artikel_mit_kategorie`
--

DROP TABLE IF EXISTS `v_artikel_mit_kategorie`;
/*!50001 DROP VIEW IF EXISTS `v_artikel_mit_kategorie`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_artikel_mit_kategorie` AS SELECT 
 1 AS `artikel_id`,
 1 AS `kategorie_id`,
 1 AS `name`,
 1 AS `beschreibung`,
 1 AS `ean_code`,
 1 AS `artikel_nummer`,
 1 AS `einkaufspreis_cent`,
 1 AS `verkaufspreis_cent`,
 1 AS `mwst_prozent`,
 1 AS `lagerbestand`,
 1 AS `mindestbestand`,
 1 AS `lager_tracking`,
 1 AS `bild_url`,
 1 AS `bild_base64`,
 1 AS `farbe_hex`,
 1 AS `aktiv`,
 1 AS `sichtbar_kasse`,
 1 AS `erstellt_am`,
 1 AS `aktualisiert_am`,
 1 AS `kategorie_name`,
 1 AS `kategorie_farbe`,
 1 AS `kategorie_icon`,
 1 AS `verkaufspreis_euro`,
 1 AS `einkaufspreis_euro`,
 1 AS `lager_status`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_verkauf_statistiken`
--

DROP TABLE IF EXISTS `v_verkauf_statistiken`;
/*!50001 DROP VIEW IF EXISTS `v_verkauf_statistiken`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_verkauf_statistiken` AS SELECT 
 1 AS `datum`,
 1 AS `anzahl_verkaeufe`,
 1 AS `umsatz_cent`,
 1 AS `bar_umsatz_cent`,
 1 AS `karte_umsatz_cent`,
 1 AS `durchschnitt_cent`*/;
SET character_set_client = @saved_cs_client;

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
  CONSTRAINT `verkauf_positionen_ibfk_2` FOREIGN KEY (`artikel_id`) REFERENCES `artikel` (`artikel_id`) ON DELETE RESTRICT
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
  `status` varchar(20) DEFAULT 'aktiv',
  `monatlicher_beitrag` decimal(10,2) DEFAULT NULL COMMENT 'Tatsächlich gezahlter monatlicher Beitrag',
  `dojo_id` int DEFAULT '1' COMMENT 'Verkn├╝pfung zum Dojo',
  `vertragsnummer` varchar(50) DEFAULT NULL COMMENT 'Eindeutige Vertragsnummer (z.B. VTR-2024-001)',
  `kuendigungsfrist_monate` int DEFAULT '3' COMMENT 'Kündigungsfrist in Monaten vor Vertragsende',
  `mindestlaufzeit_monate` int DEFAULT '12' COMMENT 'Mindestvertragslaufzeit in Monaten',
  `automatische_verlaengerung` tinyint(1) DEFAULT '1' COMMENT 'Verlängert sich der Vertrag automatisch?',
  `verlaengerung_monate` int DEFAULT '12' COMMENT 'Um wie viele Monate verlängert sich der Vertrag?',
  `faelligkeit_tag` int DEFAULT '1' COMMENT 'Tag im Monat an dem Zahlung fällig ist',
  `rabatt_prozent` decimal(5,2) DEFAULT '0.00' COMMENT 'Rabatt in Prozent',
  `rabatt_grund` varchar(255) DEFAULT NULL COMMENT 'Grund für Rabatt (Familien-Rabatt, Aktion, etc.)',
  `sepa_mandat_id` int DEFAULT NULL COMMENT 'Verknüpfung mit SEPA-Mandat',
  `agb_version` varchar(20) DEFAULT NULL COMMENT 'Version der akzeptierten AGB',
  `agb_akzeptiert_am` datetime DEFAULT NULL COMMENT 'Zeitpunkt der AGB-Akzeptanz',
  `datenschutz_version` varchar(20) DEFAULT NULL COMMENT 'Version der akzeptierten Datenschutzerklärung',
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
  `unterschrift_digital` longtext COMMENT 'Base64-kodierte digitale Unterschrift',
  `unterschrift_ip` varchar(45) DEFAULT NULL COMMENT 'IP-Adresse bei digitaler Unterschrift',
  `vertragstext_pdf_path` varchar(255) DEFAULT NULL COMMENT 'Pfad zum generierten Vertrags-PDF',
  `created_by` int DEFAULT NULL COMMENT 'Benutzer der den Vertrag erstellt hat',
  `updated_by` int DEFAULT NULL COMMENT 'Benutzer der den Vertrag zuletzt bearbeitet hat',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Zeitpunkt der letzten Änderung',
  `vertragsbeginn` date DEFAULT NULL COMMENT 'Datum des Vertragsbeginns',
  `vertragsende` date DEFAULT NULL COMMENT 'Geplantes Vertragsende (vor automatischer Verlängerung)',
  `billing_cycle` varchar(50) DEFAULT NULL COMMENT 'Zahlungsintervall: monatlich, vierteljährlich, halbjährlich, jährlich',
  `payment_method` varchar(50) DEFAULT 'direct_debit' COMMENT 'Zahlungsmethode: direct_debit (SEPA), transfer (Überweisung), bar, etc.',
  `monatsbeitrag` decimal(10,2) DEFAULT NULL COMMENT 'Monatlicher Beitrag (nach Rabatten)',
  `kuendigung_eingegangen` date DEFAULT NULL COMMENT 'Datum an dem die Kündigung eingegangen ist',
  `kuendigungsgrund` varchar(255) DEFAULT NULL COMMENT 'Grund für die Kündigung',
  `kuendigungsdatum` date DEFAULT NULL COMMENT 'Kündigungsdatum',
  `ruhepause_von` date DEFAULT NULL COMMENT 'Startdatum der Ruhepause',
  `ruhepause_bis` date DEFAULT NULL COMMENT 'Enddatum der Ruhepause',
  `ruhepause_dauer_monate` int DEFAULT NULL COMMENT 'Dauer der Ruhepause in Monaten',
  PRIMARY KEY (`id`),
  UNIQUE KEY `vertragsnummer` (`vertragsnummer`),
  KEY `idx_vertraege_dojo_id` (`dojo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertraege`
--

LOCK TABLES `vertraege` WRITE;
/*!40000 ALTER TABLE `vertraege` DISABLE KEYS */;
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
  `dokumenttyp` enum('agb','datenschutz','widerruf','hausordnung','dojokun','haftung','sonstiges') COLLATE utf8mb4_unicode_ci NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Rechtliche Dokumente (AGB, Datenschutz, etc.) pro Dojo mit Versionierung';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertragsdokumente`
--

LOCK TABLES `vertragsdokumente` WRITE;
/*!40000 ALTER TABLE `vertragsdokumente` DISABLE KEYS */;
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
  `aenderung_details` json DEFAULT NULL COMMENT 'Detaillierte Änderungen (vorher/nachher)',
  `geaendert_von` int DEFAULT NULL COMMENT 'Benutzer der die Änderung vorgenommen hat',
  `geaendert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Zeitpunkt der Änderung',
  `ip_adresse` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IP-Adresse (falls relevant)',
  PRIMARY KEY (`id`),
  KEY `idx_vertrag_datum` (`vertrag_id`,`geaendert_am`),
  CONSTRAINT `vertragshistorie_ibfk_1` FOREIGN KEY (`vertrag_id`) REFERENCES `vertraege` (`id`) ON DELETE CASCADE
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
  `available_placeholders` json DEFAULT NULL,
  `version` int DEFAULT '1',
  `erstellt_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktualisiert_am` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `erstellt_von` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `dojo_id` (`dojo_id`),
  CONSTRAINT `vertragsvorlagen_ibfk_1` FOREIGN KEY (`dojo_id`) REFERENCES `dojo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vertragsvorlagen`
--

LOCK TABLES `vertragsvorlagen` WRITE;
/*!40000 ALTER TABLE `vertragsvorlagen` DISABLE KEYS */;
INSERT INTO `vertragsvorlagen` VALUES (1,3,'Standard Mitgliedsvertrag','','<body><div id=\"ijdt\"><h4 id=\"i18i\">Datenschutzhinweise</h4><p>Mit der Unterzeichnung dieses Vertrags bestätige ich, dass ich die Datenschutzerklärung von {{dojo.dojoname}} zur Kenntnis genommen habe.</p><p id=\"iny6\">Ich bin damit einverstanden, dass meine personenbezogenen Daten zur Vertragsabwicklung und Mitgliederverwaltung gespeichert und verarbeitet werden.</p><p id=\"inozn\">Die vollständige Datenschutzerklärung ist einsehbar unter: {{dojo.internet}}/datenschutz</p><br/><p id=\"i8jhn\">☐ Ich willige ein, dass {{dojo.dojoname}} mich per E-Mail über Angebote, Events und Neuigkeiten informieren darf. Diese Einwilligung kann ich jederzeit widerrufen.</p></div></body>','* { box-sizing: border-box; } body {margin: 0;}#i18i{color:#2e7d32;margin-top:0;}#i8jhn{font-size:0.85em;}#ijdt{padding:15px;background:#e8f5e9;border-left:4px solid #4caf50;margin:20px 0;}','[{\"attributes\":{\"id\":\"ijdt\"},\"components\":[{\"tagName\":\"h4\",\"type\":\"text\",\"attributes\":{\"id\":\"i18i\"},\"components\":[{\"type\":\"textnode\",\"content\":\"Datenschutzhinweise\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mit der Unterzeichnung dieses Vertrags bestätige ich, dass ich die Datenschutzerklärung von {{dojo.dojoname}} zur Kenntnis genommen habe.\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"attributes\":{\"id\":\"iny6\"},\"components\":[{\"type\":\"textnode\",\"content\":\"Ich bin damit einverstanden, dass meine personenbezogenen Daten zur Vertragsabwicklung und Mitgliederverwaltung gespeichert und verarbeitet werden.\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"attributes\":{\"id\":\"inozn\"},\"components\":[{\"type\":\"textnode\",\"content\":\"Die vollständige Datenschutzerklärung ist einsehbar unter: {{dojo.internet}}/datenschutz\"}]},{\"tagName\":\"br\",\"void\":true},{\"tagName\":\"p\",\"type\":\"text\",\"attributes\":{\"id\":\"i8jhn\"},\"components\":[{\"type\":\"textnode\",\"content\":\"☐ Ich willige ein, dass {{dojo.dojoname}} mich per E-Mail über Angebote, Events und Neuigkeiten informieren darf. Diese Einwilligung kann ich jederzeit widerrufen.\"}]}]}]','[{\"selectors\":[\"#i18i\"],\"style\":{\"color\":\"#2e7d32\",\"margin-top\":\"0\"}},{\"selectors\":[\"#i8jhn\"],\"style\":{\"font-size\":\"0.85em\"}},{\"selectors\":[\"#ijdt\"],\"style\":{\"padding\":\"15px\",\"background\":\"#e8f5e9\",\"border-left\":\"4px solid #4caf50\",\"margin\":\"20px 0\"}}]','vertrag',0,1,'{\"dojo\": [{\"label\": \"Dojo Name\", \"value\": \"{{dojo.dojoname}}\"}, {\"label\": \"Straße\", \"value\": \"{{dojo.strasse}}\"}, {\"label\": \"Hausnummer\", \"value\": \"{{dojo.hausnummer}}\"}, {\"label\": \"PLZ\", \"value\": \"{{dojo.plz}}\"}, {\"label\": \"Ort\", \"value\": \"{{dojo.ort}}\"}, {\"label\": \"Telefon\", \"value\": \"{{dojo.telefon}}\"}, {\"label\": \"E-Mail\", \"value\": \"{{dojo.email}}\"}, {\"label\": \"Website\", \"value\": \"{{dojo.internet}}\"}], \"system\": [{\"label\": \"Heutiges Datum\", \"value\": \"{{system.datum}}\"}, {\"label\": \"Jahr\", \"value\": \"{{system.jahr}}\"}, {\"label\": \"Monat\", \"value\": \"{{system.monat}}\"}], \"vertrag\": [{\"label\": \"Vertragsnummer\", \"value\": \"{{vertrag.vertragsnummer}}\"}, {\"label\": \"Vertragsbeginn\", \"value\": \"{{vertrag.vertragsbeginn}}\"}, {\"label\": \"Vertragsende\", \"value\": \"{{vertrag.vertragsende}}\"}, {\"label\": \"Monatsbeitrag\", \"value\": \"{{vertrag.monatsbeitrag}}\"}, {\"label\": \"Mindestlaufzeit\", \"value\": \"{{vertrag.mindestlaufzeit_monate}}\"}, {\"label\": \"Kündigungsfrist\", \"value\": \"{{vertrag.kuendigungsfrist_monate}}\"}, {\"label\": \"Tarifname\", \"value\": \"{{vertrag.tarifname}}\"}], \"mitglied\": [{\"label\": \"Vorname\", \"value\": \"{{mitglied.vorname}}\"}, {\"label\": \"Nachname\", \"value\": \"{{mitglied.nachname}}\"}, {\"label\": \"E-Mail\", \"value\": \"{{mitglied.email}}\"}, {\"label\": \"Telefon\", \"value\": \"{{mitglied.telefon}}\"}, {\"label\": \"Straße\", \"value\": \"{{mitglied.strasse}}\"}, {\"label\": \"Hausnummer\", \"value\": \"{{mitglied.hausnummer}}\"}, {\"label\": \"PLZ\", \"value\": \"{{mitglied.plz}}\"}, {\"label\": \"Ort\", \"value\": \"{{mitglied.ort}}\"}, {\"label\": \"Geburtsdatum\", \"value\": \"{{mitglied.geburtsdatum}}\"}, {\"label\": \"Mitgliedsnummer\", \"value\": \"{{mitglied.mitgliedsnummer}}\"}]}',1,'2025-10-22 11:10:30','2025-10-22 11:10:30',NULL),(4,2,'Mitgliedsvertrag - TDA Style','','<body><!-- SEITE 1: MITGLIEDSVERTRAG --><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/><title>Mitgliedsvertrag</title><div class=\"page\"><div class=\"header\"><div class=\"header-left\"><h1>MITGLIEDSVERTRAG</h1><h2>{{dojo_name}}</h2></div><div class=\"logo-placeholder\">\n                LOGO\n            </div></div><div class=\"section-title\">PERSÖNLICHE DATEN</div><div class=\"data-grid\"><div class=\"data-field\"><label>Mitgliedsnummer</label><div class=\"value\">{{mitglied_id}}</div></div><div class=\"data-field\"><label>Anrede</label><div class=\"value\">{{anrede}}</div></div><div class=\"data-field\"><label>Vorname</label><div class=\"value\">{{vorname}}</div></div><div class=\"data-field\"><label>Nachname</label><div class=\"value\">{{nachname}}</div></div></div><div class=\"address-grid\"><div class=\"data-field\"><label>Straße</label><div class=\"value\">{{strasse}}</div></div><div class=\"data-field\"><label>Hausnummer</label><div class=\"value\">{{hausnummer}}</div></div><div class=\"data-field\"><label>PLZ</label><div class=\"value\">{{plz}}</div></div><div class=\"data-field\"><label>Ort</label><div class=\"value\">{{ort}}</div></div></div><div class=\"data-grid\"><div class=\"data-field\"><label>Telefonnummer</label><div class=\"value\">{{telefon}}</div></div><div class=\"data-field\"><label>E-Mail-Adresse</label><div class=\"value\">{{email}}</div></div><div class=\"data-field\"><label>Mobil</label><div class=\"value\">{{mobil}}</div></div><div class=\"data-field\"><label>Geburtsdatum</label><div class=\"value\">{{geburtsdatum}}</div></div></div><div class=\"section-title\">VERTRAGSDATEN</div><p class=\"intro-text\">Ich habe mich für den nachfolgenden Tarif entschieden:</p><div class=\"contract-grid\"><div class=\"data-field\"><label>Tarifname</label><div class=\"value\">{{tarif_name}}</div></div><div class=\"data-field\"><label>Höhe Betrag</label><div class=\"value\">{{betrag}} €</div></div><div class=\"data-field\"><label>Aufnahmegebühr</label><div class=\"value\">{{aufnahmegebuehr}} €</div></div><div class=\"data-field\"><label>Mindestlaufzeit</label><div class=\"value\">{{mindestlaufzeit}}</div></div><div class=\"data-field\"><label>Vertragsbeginn</label><div class=\"value\">{{vertragsbeginn}}</div></div><div class=\"data-field\"><label>Nutzungsbeginn</label><div class=\"value\">{{nutzungsbeginn}}</div></div><div class=\"data-field\"><label>Vertragsverlängerungsdauer</label><div class=\"value\">{{vertragsverlaengerung}}</div></div><div class=\"data-field\"><label>Kündigungsfrist</label><div class=\"value\">{{kuendigungsfrist}}</div></div><div class=\"data-field\"><label>Zahlweise</label><div class=\"value\">{{zahlweise}}</div></div></div><div class=\"total-box\">\n            Gesamt (inkl. Pauschalen und Zusatzmodule)<br/>\n            {{betrag}} € {{zahlweise}}\n        </div><p class=\"legal-text\">\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.<br/>\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\n        </p><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"ivgjfp\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Vertragsnehmer\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 2: SEPA-LASTSCHRIFTMANDAT --><div class=\"page\"><div class=\"section-title\">SEPA-LASTSCHRIFTMANDAT</div><p class=\"legal-text\">\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.<br/><br/>\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\n        </p><div class=\"data-grid\"><div class=\"data-field data-field-wide\"><label>Vorname und Name (Kontoinhaber)</label><div class=\"value\">{{kontoinhaber}}</div></div><div class=\"data-field\"><label>Kreditinstitut (Name)</label><div class=\"value\">{{kreditinstitut}}</div></div><div class=\"data-field\"><label>BIC</label><div class=\"value\">{{bic}}</div></div><div class=\"data-field data-field-wide\"><label>IBAN</label><div class=\"value\">{{iban}}</div></div><div class=\"data-field data-field-wide\"><label>SEPA Mandatsreferenz-Nummer</label><div class=\"value\">{{sepa_referenz}}</div></div></div><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"itf9vg\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Kontoinhaber\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 3: ZAHLUNGSTERMINE --><div class=\"page\"><div class=\"section-title\">ZAHLUNGSTERMINE</div>\n\n        \n                {{zahlungstermine}}\n            <table><thead><tr><th>Fälligkeitsdatum</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th></tr></thead><tbody><tr class=\"row\"><td class=\"cell\"></td></tr></tbody></table><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div></body>','* { box-sizing: border-box; } body {margin: 0;}body{font-family:Arial, sans-serif;font-size:11pt;line-height:1.4;color:rgb(51, 51, 51);margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;padding-top:20px;padding-right:20px;padding-bottom:20px;padding-left:20px;}.page{width:210mm;min-height:297mm;padding-top:20mm;padding-right:20mm;padding-bottom:20mm;padding-left:20mm;margin-top:0px;margin-right:auto;margin-bottom:0px;margin-left:auto;background-image:initial;background-position-x:initial;background-position-y:initial;background-size:initial;background-repeat:initial;background-attachment:initial;background-origin:initial;background-clip:initial;background-color:white;break-after:page;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}.header-left h1{font-size:24pt;font-weight:bold;margin-top:0px;margin-right:0px;margin-bottom:5px;margin-left:0px;color:rgb(51, 51, 51);}.header-left h2{font-size:18pt;font-weight:normal;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;color:rgb(102, 102, 102);}.logo-placeholder{width:120px;height:120px;border-top-width:2px;border-right-width:2px;border-bottom-width:2px;border-left-width:2px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(51, 51, 51);border-right-color:rgb(51, 51, 51);border-bottom-color:rgb(51, 51, 51);border-left-color:rgb(51, 51, 51);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;border-top-left-radius:50%;border-top-right-radius:50%;border-bottom-right-radius:50%;border-bottom-left-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10pt;color:rgb(153, 153, 153);}.section-title{font-size:14pt;font-weight:bold;margin-top:25px;margin-right:0px;margin-bottom:15px;margin-left:0px;text-transform:uppercase;}.data-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.data-field{margin-bottom:10px;}.data-field label{display:block;font-size:9pt;color:rgb(102, 102, 102);margin-bottom:3px;}.data-field .value{background-color:rgb(232, 232, 232);padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-left-radius:3px;border-top-right-radius:3px;border-bottom-right-radius:3px;border-bottom-left-radius:3px;min-height:20px;font-size:11pt;}.data-field-wide{grid-column-start:1;grid-column-end:-1;}.address-grid{display:grid;grid-template-columns:2fr 1fr 1fr 2fr;row-gap:10px;column-gap:10px;}.contract-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.total-box{background-color:rgb(232, 232, 232);padding-top:12px;padding-right:12px;padding-bottom:12px;padding-left:12px;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;font-weight:bold;font-size:12pt;}.legal-text{font-size:10pt;line-height:1.6;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;color:rgb(85, 85, 85);}.signature-section{margin-top:50px;display:flex;justify-content:space-between;}.signature-box{width:45%;}.signature-line{border-top-width:1px;border-top-style:solid;border-top-color:rgb(51, 51, 51);margin-top:60px;padding-top:8px;font-size:9pt;color:rgb(102, 102, 102);}.footer{position:absolute;bottom:15mm;left:20mm;right:20mm;text-align:center;font-size:8pt;color:rgb(102, 102, 102);border-top-width:1px;border-top-style:solid;border-top-color:rgb(204, 204, 204);padding-top:10px;}.footer-line{margin-top:3px;margin-right:0px;margin-bottom:3px;margin-left:0px;}table{width:100%;border-collapse:collapse;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;}table th{background-color:rgb(232, 232, 232);padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;text-align:left;font-size:10pt;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;}table td{padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;font-size:10pt;}.intro-text{font-size:10pt;margin-bottom:15px;}@page{size:a4;margin-top:2cm;margin-right:2cm;margin-bottom:2cm;margin-left:2cm;}@media print{body{padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}.page{margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;border-top-width:initial;border-right-width:initial;border-bottom-width:initial;border-left-width:initial;border-top-style:none;border-right-style:none;border-bottom-style:none;border-left-style:none;border-top-color:initial;border-right-color:initial;border-bottom-color:initial;border-left-color:initial;border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}}','[{\"type\":\"comment\",\"content\":\" SEITE 1: MITGLIEDSVERTRAG \"},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"charset\":\"UTF-8\"}},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"name\":\"viewport\",\"content\":\"width=device-width, initial-scale=1.0\"}},{\"tagName\":\"title\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsvertrag\"}]},{\"classes\":[\"page\"],\"components\":[{\"classes\":[\"header\"],\"components\":[{\"classes\":[\"header-left\"],\"components\":[{\"tagName\":\"h1\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"MITGLIEDSVERTRAG\"}]},{\"tagName\":\"h2\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_name}}\"}]}]},{\"type\":\"text\",\"classes\":[\"logo-placeholder\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                LOGO\\n            \"}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"PERSÖNLICHE DATEN\"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mitglied_id}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Anrede\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{anrede}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vorname}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nachname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nachname}}\"}]}]}]},{\"classes\":[\"address-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Straße\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{strasse}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Hausnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{hausnummer}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"PLZ\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{plz}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Ort\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}\"}]}]}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Telefonnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{telefon}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"E-Mail-Adresse\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{email}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mobil\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mobil}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Geburtsdatum\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{geburtsdatum}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"VERTRAGSDATEN\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"intro-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Ich habe mich für den nachfolgenden Tarif entschieden:\"}]},{\"classes\":[\"contract-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Tarifname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{tarif_name}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Höhe Betrag\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{betrag}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Aufnahmegebühr\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{aufnahmegebuehr}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mindestlaufzeit\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mindestlaufzeit}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nutzungsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nutzungsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsverlängerungsdauer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsverlaengerung}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kündigungsfrist\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kuendigungsfrist}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Zahlweise\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{zahlweise}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"total-box\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Gesamt (inkl. Pauschalen und Zusatzmodule)\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            {{betrag}} € {{zahlweise}}\\n        \"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\\n        \"}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"ivgjfp\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Vertragsnehmer\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 2: SEPA-LASTSCHRIFTMANDAT \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA-LASTSCHRIFTMANDAT\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.\"},{\"tagName\":\"br\",\"void\":true},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\\n        \"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname und Name (Kontoinhaber)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kontoinhaber}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kreditinstitut (Name)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kreditinstitut}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"BIC\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{bic}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"IBAN\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{iban}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA Mandatsreferenz-Nummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{sepa_referenz}}\"}]}]}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"itf9vg\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Kontoinhaber\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 3: ZAHLUNGSTERMINE \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"ZAHLUNGSTERMINE\"}]},{\"type\":\"textnode\",\"content\":\"\\n\\n        \\n                {{zahlungstermine}}\\n            \"},{\"type\":\"table\",\"droppable\":[\"tbody\",\"thead\",\"tfoot\"],\"components\":[{\"type\":\"thead\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"components\":[{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Fälligkeitsdatum\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Typ\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Beschreibung\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Betrag\"}]}]}]},{\"type\":\"tbody\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"classes\":[\"row\"],\"components\":[{\"type\":\"cell\",\"draggable\":[\"tr\"],\"classes\":[\"cell\"]}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]}]','[{\"selectors\":[],\"style\":{\"size\":\"a4\",\"margin-top\":\"2cm\",\"margin-right\":\"2cm\",\"margin-bottom\":\"2cm\",\"margin-left\":\"2cm\"},\"atRuleType\":\"page\",\"singleAtRule\":true},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"font-family\":\"Arial, sans-serif\",\"font-size\":\"11pt\",\"line-height\":\"1.4\",\"color\":\"rgb(51, 51, 51)\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"padding-top\":\"20px\",\"padding-right\":\"20px\",\"padding-bottom\":\"20px\",\"padding-left\":\"20px\"}},{\"selectors\":[\"page\"],\"style\":{\"width\":\"210mm\",\"min-height\":\"297mm\",\"padding-top\":\"20mm\",\"padding-right\":\"20mm\",\"padding-bottom\":\"20mm\",\"padding-left\":\"20mm\",\"margin-top\":\"0px\",\"margin-right\":\"auto\",\"margin-bottom\":\"0px\",\"margin-left\":\"auto\",\"background-image\":\"initial\",\"background-position-x\":\"initial\",\"background-position-y\":\"initial\",\"background-size\":\"initial\",\"background-repeat\":\"initial\",\"background-attachment\":\"initial\",\"background-origin\":\"initial\",\"background-clip\":\"initial\",\"background-color\":\"white\",\"break-after\":\"page\"}},{\"selectors\":[\"header\"],\"style\":{\"display\":\"flex\",\"justify-content\":\"space-between\",\"align-items\":\"flex-start\",\"margin-bottom\":\"30px\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h1\",\"style\":{\"font-size\":\"24pt\",\"font-weight\":\"bold\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"5px\",\"margin-left\":\"0px\",\"color\":\"rgb(51, 51, 51)\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h2\",\"style\":{\"font-size\":\"18pt\",\"font-weight\":\"normal\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"logo-placeholder\"],\"style\":{\"width\":\"120px\",\"height\":\"120px\",\"border-top-width\":\"2px\",\"border-right-width\":\"2px\",\"border-bottom-width\":\"2px\",\"border-left-width\":\"2px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"border-right-color\":\"rgb(51, 51, 51)\",\"border-bottom-color\":\"rgb(51, 51, 51)\",\"border-left-color\":\"rgb(51, 51, 51)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"border-top-left-radius\":\"50%\",\"border-top-right-radius\":\"50%\",\"border-bottom-right-radius\":\"50%\",\"border-bottom-left-radius\":\"50%\",\"display\":\"flex\",\"align-items\":\"center\",\"justify-content\":\"center\",\"font-size\":\"10pt\",\"color\":\"rgb(153, 153, 153)\"}},{\"selectors\":[\"section-title\"],\"style\":{\"font-size\":\"14pt\",\"font-weight\":\"bold\",\"margin-top\":\"25px\",\"margin-right\":\"0px\",\"margin-bottom\":\"15px\",\"margin-left\":\"0px\",\"text-transform\":\"uppercase\"}},{\"selectors\":[\"data-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"data-field\"],\"style\":{\"margin-bottom\":\"10px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field label\",\"style\":{\"display\":\"block\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\",\"margin-bottom\":\"3px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field .value\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-left-radius\":\"3px\",\"border-top-right-radius\":\"3px\",\"border-bottom-right-radius\":\"3px\",\"border-bottom-left-radius\":\"3px\",\"min-height\":\"20px\",\"font-size\":\"11pt\"}},{\"selectors\":[\"data-field-wide\"],\"style\":{\"grid-column-start\":\"1\",\"grid-column-end\":\"-1\"}},{\"selectors\":[\"address-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"2fr 1fr 1fr 2fr\",\"row-gap\":\"10px\",\"column-gap\":\"10px\"}},{\"selectors\":[\"contract-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"total-box\"],\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"12px\",\"padding-right\":\"12px\",\"padding-bottom\":\"12px\",\"padding-left\":\"12px\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"font-weight\":\"bold\",\"font-size\":\"12pt\"}},{\"selectors\":[\"legal-text\"],\"style\":{\"font-size\":\"10pt\",\"line-height\":\"1.6\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"color\":\"rgb(85, 85, 85)\"}},{\"selectors\":[\"signature-section\"],\"style\":{\"margin-top\":\"50px\",\"display\":\"flex\",\"justify-content\":\"space-between\"}},{\"selectors\":[\"signature-box\"],\"style\":{\"width\":\"45%\"}},{\"selectors\":[\"signature-line\"],\"style\":{\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"margin-top\":\"60px\",\"padding-top\":\"8px\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"footer\"],\"style\":{\"position\":\"absolute\",\"bottom\":\"15mm\",\"left\":\"20mm\",\"right\":\"20mm\",\"text-align\":\"center\",\"font-size\":\"8pt\",\"color\":\"rgb(102, 102, 102)\",\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"padding-top\":\"10px\"}},{\"selectors\":[\"footer-line\"],\"style\":{\"margin-top\":\"3px\",\"margin-right\":\"0px\",\"margin-bottom\":\"3px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table\",\"style\":{\"width\":\"100%\",\"border-collapse\":\"collapse\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table th\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"10px\",\"padding-right\":\"10px\",\"padding-bottom\":\"10px\",\"padding-left\":\"10px\",\"text-align\":\"left\",\"font-size\":\"10pt\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\"}},{\"selectors\":[],\"selectorsAdd\":\"table td\",\"style\":{\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"font-size\":\"10pt\"}},{\"selectors\":[\"intro-text\"],\"style\":{\"font-size\":\"10pt\",\"margin-bottom\":\"15px\"}},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"},{\"selectors\":[\"page\"],\"style\":{\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"border-top-width\":\"initial\",\"border-right-width\":\"initial\",\"border-bottom-width\":\"initial\",\"border-left-width\":\"initial\",\"border-top-style\":\"none\",\"border-right-style\":\"none\",\"border-bottom-style\":\"none\",\"border-left-style\":\"none\",\"border-top-color\":\"initial\",\"border-right-color\":\"initial\",\"border-bottom-color\":\"initial\",\"border-left-color\":\"initial\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"}]','vertrag',1,1,NULL,2,'2025-10-26 14:23:52','2025-10-26 14:44:57',NULL),(5,3,'Mitgliedsvertrag - TDA Style (Kopie)','','<body><!-- SEITE 1: MITGLIEDSVERTRAG --><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/><title>Mitgliedsvertrag</title><div class=\"page\"><div class=\"header\"><div class=\"header-left\"><h1>MITGLIEDSVERTRAG</h1><h2>{{dojo_name}}</h2></div><div class=\"logo-placeholder\">\n                LOGO\n            </div></div><div class=\"section-title\">PERSÖNLICHE DATEN</div><div class=\"data-grid\"><div class=\"data-field\"><label>Mitgliedsnummer</label><div class=\"value\">{{mitglied_id}}</div></div><div class=\"data-field\"><label>Anrede</label><div class=\"value\">{{anrede}}</div></div><div class=\"data-field\"><label>Vorname</label><div class=\"value\">{{vorname}}</div></div><div class=\"data-field\"><label>Nachname</label><div class=\"value\">{{nachname}}</div></div></div><div class=\"address-grid\"><div class=\"data-field\"><label>Straße</label><div class=\"value\">{{strasse}}</div></div><div class=\"data-field\"><label>Hausnummer</label><div class=\"value\">{{hausnummer}}</div></div><div class=\"data-field\"><label>PLZ</label><div class=\"value\">{{plz}}</div></div><div class=\"data-field\"><label>Ort</label><div class=\"value\">{{ort}}</div></div></div><div class=\"data-grid\"><div class=\"data-field\"><label>Telefonnummer</label><div class=\"value\">{{telefon}}</div></div><div class=\"data-field\"><label>E-Mail-Adresse</label><div class=\"value\">{{email}}</div></div><div class=\"data-field\"><label>Mobil</label><div class=\"value\">{{mobil}}</div></div><div class=\"data-field\"><label>Geburtsdatum</label><div class=\"value\">{{geburtsdatum}}</div></div></div><div class=\"section-title\">VERTRAGSDATEN</div><p class=\"intro-text\">Ich habe mich für den nachfolgenden Tarif entschieden:</p><div class=\"contract-grid\"><div class=\"data-field\"><label>Tarifname</label><div class=\"value\">{{tarif_name}}</div></div><div class=\"data-field\"><label>Höhe Betrag</label><div class=\"value\">{{betrag}} €</div></div><div class=\"data-field\"><label>Aufnahmegebühr</label><div class=\"value\">{{aufnahmegebuehr}} €</div></div><div class=\"data-field\"><label>Mindestlaufzeit</label><div class=\"value\">{{mindestlaufzeit}}</div></div><div class=\"data-field\"><label>Vertragsbeginn</label><div class=\"value\">{{vertragsbeginn}}</div></div><div class=\"data-field\"><label>Nutzungsbeginn</label><div class=\"value\">{{nutzungsbeginn}}</div></div><div class=\"data-field\"><label>Vertragsverlängerungsdauer</label><div class=\"value\">{{vertragsverlaengerung}}</div></div><div class=\"data-field\"><label>Kündigungsfrist</label><div class=\"value\">{{kuendigungsfrist}}</div></div><div class=\"data-field\"><label>Zahlweise</label><div class=\"value\">{{zahlweise}}</div></div></div><div class=\"total-box\">\n            Gesamt (inkl. Pauschalen und Zusatzmodule)<br/>\n            {{betrag}} € {{zahlweise}}\n        </div><p class=\"legal-text\">\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.<br/>\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\n        </p><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"ivgjfp\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Vertragsnehmer\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 2: SEPA-LASTSCHRIFTMANDAT --><div class=\"page\"><div class=\"section-title\">SEPA-LASTSCHRIFTMANDAT</div><p class=\"legal-text\">\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.<br/><br/>\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\n        </p><div class=\"data-grid\"><div class=\"data-field data-field-wide\"><label>Vorname und Name (Kontoinhaber)</label><div class=\"value\">{{kontoinhaber}}</div></div><div class=\"data-field\"><label>Kreditinstitut (Name)</label><div class=\"value\">{{kreditinstitut}}</div></div><div class=\"data-field\"><label>BIC</label><div class=\"value\">{{bic}}</div></div><div class=\"data-field data-field-wide\"><label>IBAN</label><div class=\"value\">{{iban}}</div></div><div class=\"data-field data-field-wide\"><label>SEPA Mandatsreferenz-Nummer</label><div class=\"value\">{{sepa_referenz}}</div></div></div><div class=\"signature-section\"><div class=\"signature-box\"><div id=\"itf9vg\">{{ort}}, {{datum}}</div><div class=\"signature-line\">\n                    Ort, Datum/Unterschrift Kontoinhaber\n                </div></div></div><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div><!-- SEITE 3: ZAHLUNGSTERMINE --><div class=\"page\"><div class=\"section-title\">ZAHLUNGSTERMINE</div>\n\n        \n                {{zahlungstermine}}\n            <table><thead><tr><th>Fälligkeitsdatum</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th></tr></thead><tbody><tr class=\"row\"><td class=\"cell\"></td></tr></tbody></table><div class=\"footer\"><div class=\"footer-line\">{{dojo_adresse}}</div><div class=\"footer-line\">{{dojo_kontakt}}</div></div></div></body>','* { box-sizing: border-box; } body {margin: 0;}body{font-family:Arial, sans-serif;font-size:11pt;line-height:1.4;color:rgb(51, 51, 51);margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;padding-top:20px;padding-right:20px;padding-bottom:20px;padding-left:20px;}.page{width:210mm;min-height:297mm;padding-top:20mm;padding-right:20mm;padding-bottom:20mm;padding-left:20mm;margin-top:0px;margin-right:auto;margin-bottom:0px;margin-left:auto;background-image:initial;background-position-x:initial;background-position-y:initial;background-size:initial;background-repeat:initial;background-attachment:initial;background-origin:initial;background-clip:initial;background-color:white;break-after:page;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}.header-left h1{font-size:24pt;font-weight:bold;margin-top:0px;margin-right:0px;margin-bottom:5px;margin-left:0px;color:rgb(51, 51, 51);}.header-left h2{font-size:18pt;font-weight:normal;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;color:rgb(102, 102, 102);}.logo-placeholder{width:120px;height:120px;border-top-width:2px;border-right-width:2px;border-bottom-width:2px;border-left-width:2px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(51, 51, 51);border-right-color:rgb(51, 51, 51);border-bottom-color:rgb(51, 51, 51);border-left-color:rgb(51, 51, 51);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;border-top-left-radius:50%;border-top-right-radius:50%;border-bottom-right-radius:50%;border-bottom-left-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10pt;color:rgb(153, 153, 153);}.section-title{font-size:14pt;font-weight:bold;margin-top:25px;margin-right:0px;margin-bottom:15px;margin-left:0px;text-transform:uppercase;}.data-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.data-field{margin-bottom:10px;}.data-field label{display:block;font-size:9pt;color:rgb(102, 102, 102);margin-bottom:3px;}.data-field .value{background-color:rgb(232, 232, 232);padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-left-radius:3px;border-top-right-radius:3px;border-bottom-right-radius:3px;border-bottom-left-radius:3px;min-height:20px;font-size:11pt;}.data-field-wide{grid-column-start:1;grid-column-end:-1;}.address-grid{display:grid;grid-template-columns:2fr 1fr 1fr 2fr;row-gap:10px;column-gap:10px;}.contract-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:15px;column-gap:15px;margin-bottom:20px;}.total-box{background-color:rgb(232, 232, 232);padding-top:12px;padding-right:12px;padding-bottom:12px;padding-left:12px;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;font-weight:bold;font-size:12pt;}.legal-text{font-size:10pt;line-height:1.6;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;color:rgb(85, 85, 85);}.signature-section{margin-top:50px;display:flex;justify-content:space-between;}.signature-box{width:45%;}.signature-line{border-top-width:1px;border-top-style:solid;border-top-color:rgb(51, 51, 51);margin-top:60px;padding-top:8px;font-size:9pt;color:rgb(102, 102, 102);}.footer{position:absolute;bottom:15mm;left:20mm;right:20mm;text-align:center;font-size:8pt;color:rgb(102, 102, 102);border-top-width:1px;border-top-style:solid;border-top-color:rgb(204, 204, 204);padding-top:10px;}.footer-line{margin-top:3px;margin-right:0px;margin-bottom:3px;margin-left:0px;}table{width:100%;border-collapse:collapse;margin-top:20px;margin-right:0px;margin-bottom:20px;margin-left:0px;}table th{background-color:rgb(232, 232, 232);padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;text-align:left;font-size:10pt;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;}table td{padding-top:8px;padding-right:10px;padding-bottom:8px;padding-left:10px;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(204, 204, 204);border-right-color:rgb(204, 204, 204);border-bottom-color:rgb(204, 204, 204);border-left-color:rgb(204, 204, 204);border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;font-size:10pt;}.intro-text{font-size:10pt;margin-bottom:15px;}@page{size:a4;margin-top:2cm;margin-right:2cm;margin-bottom:2cm;margin-left:2cm;}@media print{body{padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}.page{margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;border-top-width:initial;border-right-width:initial;border-bottom-width:initial;border-left-width:initial;border-top-style:none;border-right-style:none;border-bottom-style:none;border-left-style:none;border-top-color:initial;border-right-color:initial;border-bottom-color:initial;border-left-color:initial;border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;}}','[{\"type\":\"comment\",\"content\":\" SEITE 1: MITGLIEDSVERTRAG \"},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"charset\":\"UTF-8\"}},{\"tagName\":\"meta\",\"void\":true,\"attributes\":{\"name\":\"viewport\",\"content\":\"width=device-width, initial-scale=1.0\"}},{\"tagName\":\"title\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsvertrag\"}]},{\"classes\":[\"page\"],\"components\":[{\"classes\":[\"header\"],\"components\":[{\"classes\":[\"header-left\"],\"components\":[{\"tagName\":\"h1\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"MITGLIEDSVERTRAG\"}]},{\"tagName\":\"h2\",\"type\":\"text\",\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_name}}\"}]}]},{\"type\":\"text\",\"classes\":[\"logo-placeholder\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                LOGO\\n            \"}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"PERSÖNLICHE DATEN\"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mitgliedsnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mitglied_id}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Anrede\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{anrede}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vorname}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nachname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nachname}}\"}]}]}]},{\"classes\":[\"address-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Straße\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{strasse}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Hausnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{hausnummer}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"PLZ\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{plz}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Ort\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}\"}]}]}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Telefonnummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{telefon}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"E-Mail-Adresse\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{email}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mobil\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mobil}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Geburtsdatum\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{geburtsdatum}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"VERTRAGSDATEN\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"intro-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Ich habe mich für den nachfolgenden Tarif entschieden:\"}]},{\"classes\":[\"contract-grid\"],\"components\":[{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Tarifname\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{tarif_name}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Höhe Betrag\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{betrag}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Aufnahmegebühr\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{aufnahmegebuehr}} €\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Mindestlaufzeit\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{mindestlaufzeit}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Nutzungsbeginn\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{nutzungsbeginn}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vertragsverlängerungsdauer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{vertragsverlaengerung}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kündigungsfrist\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kuendigungsfrist}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Zahlweise\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{zahlweise}}\"}]}]}]},{\"type\":\"text\",\"classes\":[\"total-box\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Gesamt (inkl. Pauschalen und Zusatzmodule)\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            {{betrag}} € {{zahlweise}}\\n        \"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Es gelten die beigefügten AGB des Vertragsgebers, namentlich {{dojo_name}}.\"},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Dieser Vertrag ist auch ohne Unterschrift von {{dojo_name}} wirksam.\\n        \"}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"ivgjfp\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Vertragsnehmer\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 2: SEPA-LASTSCHRIFTMANDAT \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA-LASTSCHRIFTMANDAT\"}]},{\"tagName\":\"p\",\"type\":\"text\",\"classes\":[\"legal-text\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n            Ich ermächtige {{zahlungsdienstleister}}, Zahlungen von meinem Konto unter Angabe der Gläubiger ID-Nr {{glaeubiger_id}} mittels Lastschrift einzuziehen.\"},{\"tagName\":\"br\",\"void\":true},{\"tagName\":\"br\",\"void\":true},{\"type\":\"textnode\",\"content\":\"\\n            Zugleich weise ich mein Kreditinstitut an, die von {{zahlungsdienstleister}} auf meinem Konto gezogenen Lastschriften einzulösen.\\n        \"}]},{\"classes\":[\"data-grid\"],\"components\":[{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Vorname und Name (Kontoinhaber)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kontoinhaber}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"Kreditinstitut (Name)\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{kreditinstitut}}\"}]}]},{\"classes\":[\"data-field\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"BIC\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{bic}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"IBAN\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{iban}}\"}]}]},{\"classes\":[\"data-field\",\"data-field-wide\"],\"components\":[{\"type\":\"label\",\"components\":[{\"type\":\"textnode\",\"content\":\"SEPA Mandatsreferenz-Nummer\"}]},{\"type\":\"text\",\"classes\":[\"value\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{sepa_referenz}}\"}]}]}]},{\"classes\":[\"signature-section\"],\"components\":[{\"classes\":[\"signature-box\"],\"components\":[{\"type\":\"text\",\"attributes\":{\"id\":\"itf9vg\"},\"components\":[{\"type\":\"textnode\",\"content\":\"{{ort}}, {{datum}}\"}]},{\"type\":\"text\",\"classes\":[\"signature-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"\\n                    Ort, Datum/Unterschrift Kontoinhaber\\n                \"}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]},{\"type\":\"comment\",\"content\":\" SEITE 3: ZAHLUNGSTERMINE \"},{\"classes\":[\"page\"],\"components\":[{\"type\":\"text\",\"classes\":[\"section-title\"],\"components\":[{\"type\":\"textnode\",\"content\":\"ZAHLUNGSTERMINE\"}]},{\"type\":\"textnode\",\"content\":\"\\n\\n        \\n                {{zahlungstermine}}\\n            \"},{\"type\":\"table\",\"droppable\":[\"tbody\",\"thead\",\"tfoot\"],\"components\":[{\"type\":\"thead\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"components\":[{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Fälligkeitsdatum\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Typ\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Beschreibung\"}]},{\"tagName\":\"th\",\"type\":\"cell\",\"draggable\":[\"tr\"],\"components\":[{\"type\":\"textnode\",\"content\":\"Betrag\"}]}]}]},{\"type\":\"tbody\",\"draggable\":[\"table\"],\"droppable\":[\"tr\"],\"components\":[{\"type\":\"row\",\"draggable\":[\"thead\",\"tbody\",\"tfoot\"],\"droppable\":[\"th\",\"td\"],\"classes\":[\"row\"],\"components\":[{\"type\":\"cell\",\"draggable\":[\"tr\"],\"classes\":[\"cell\"]}]}]}]},{\"classes\":[\"footer\"],\"components\":[{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_adresse}}\"}]},{\"type\":\"text\",\"classes\":[\"footer-line\"],\"components\":[{\"type\":\"textnode\",\"content\":\"{{dojo_kontakt}}\"}]}]}]}]','[{\"selectors\":[],\"style\":{\"size\":\"a4\",\"margin-top\":\"2cm\",\"margin-right\":\"2cm\",\"margin-bottom\":\"2cm\",\"margin-left\":\"2cm\"},\"atRuleType\":\"page\",\"singleAtRule\":true},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"font-family\":\"Arial, sans-serif\",\"font-size\":\"11pt\",\"line-height\":\"1.4\",\"color\":\"rgb(51, 51, 51)\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"padding-top\":\"20px\",\"padding-right\":\"20px\",\"padding-bottom\":\"20px\",\"padding-left\":\"20px\"}},{\"selectors\":[\"page\"],\"style\":{\"width\":\"210mm\",\"min-height\":\"297mm\",\"padding-top\":\"20mm\",\"padding-right\":\"20mm\",\"padding-bottom\":\"20mm\",\"padding-left\":\"20mm\",\"margin-top\":\"0px\",\"margin-right\":\"auto\",\"margin-bottom\":\"0px\",\"margin-left\":\"auto\",\"background-image\":\"initial\",\"background-position-x\":\"initial\",\"background-position-y\":\"initial\",\"background-size\":\"initial\",\"background-repeat\":\"initial\",\"background-attachment\":\"initial\",\"background-origin\":\"initial\",\"background-clip\":\"initial\",\"background-color\":\"white\",\"break-after\":\"page\"}},{\"selectors\":[\"header\"],\"style\":{\"display\":\"flex\",\"justify-content\":\"space-between\",\"align-items\":\"flex-start\",\"margin-bottom\":\"30px\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h1\",\"style\":{\"font-size\":\"24pt\",\"font-weight\":\"bold\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"5px\",\"margin-left\":\"0px\",\"color\":\"rgb(51, 51, 51)\"}},{\"selectors\":[],\"selectorsAdd\":\".header-left h2\",\"style\":{\"font-size\":\"18pt\",\"font-weight\":\"normal\",\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"logo-placeholder\"],\"style\":{\"width\":\"120px\",\"height\":\"120px\",\"border-top-width\":\"2px\",\"border-right-width\":\"2px\",\"border-bottom-width\":\"2px\",\"border-left-width\":\"2px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"border-right-color\":\"rgb(51, 51, 51)\",\"border-bottom-color\":\"rgb(51, 51, 51)\",\"border-left-color\":\"rgb(51, 51, 51)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"border-top-left-radius\":\"50%\",\"border-top-right-radius\":\"50%\",\"border-bottom-right-radius\":\"50%\",\"border-bottom-left-radius\":\"50%\",\"display\":\"flex\",\"align-items\":\"center\",\"justify-content\":\"center\",\"font-size\":\"10pt\",\"color\":\"rgb(153, 153, 153)\"}},{\"selectors\":[\"section-title\"],\"style\":{\"font-size\":\"14pt\",\"font-weight\":\"bold\",\"margin-top\":\"25px\",\"margin-right\":\"0px\",\"margin-bottom\":\"15px\",\"margin-left\":\"0px\",\"text-transform\":\"uppercase\"}},{\"selectors\":[\"data-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"data-field\"],\"style\":{\"margin-bottom\":\"10px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field label\",\"style\":{\"display\":\"block\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\",\"margin-bottom\":\"3px\"}},{\"selectors\":[],\"selectorsAdd\":\".data-field .value\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-left-radius\":\"3px\",\"border-top-right-radius\":\"3px\",\"border-bottom-right-radius\":\"3px\",\"border-bottom-left-radius\":\"3px\",\"min-height\":\"20px\",\"font-size\":\"11pt\"}},{\"selectors\":[\"data-field-wide\"],\"style\":{\"grid-column-start\":\"1\",\"grid-column-end\":\"-1\"}},{\"selectors\":[\"address-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"2fr 1fr 1fr 2fr\",\"row-gap\":\"10px\",\"column-gap\":\"10px\"}},{\"selectors\":[\"contract-grid\"],\"style\":{\"display\":\"grid\",\"grid-template-columns\":\"repeat(2, 1fr)\",\"row-gap\":\"15px\",\"column-gap\":\"15px\",\"margin-bottom\":\"20px\"}},{\"selectors\":[\"total-box\"],\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"12px\",\"padding-right\":\"12px\",\"padding-bottom\":\"12px\",\"padding-left\":\"12px\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"font-weight\":\"bold\",\"font-size\":\"12pt\"}},{\"selectors\":[\"legal-text\"],\"style\":{\"font-size\":\"10pt\",\"line-height\":\"1.6\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\",\"color\":\"rgb(85, 85, 85)\"}},{\"selectors\":[\"signature-section\"],\"style\":{\"margin-top\":\"50px\",\"display\":\"flex\",\"justify-content\":\"space-between\"}},{\"selectors\":[\"signature-box\"],\"style\":{\"width\":\"45%\"}},{\"selectors\":[\"signature-line\"],\"style\":{\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(51, 51, 51)\",\"margin-top\":\"60px\",\"padding-top\":\"8px\",\"font-size\":\"9pt\",\"color\":\"rgb(102, 102, 102)\"}},{\"selectors\":[\"footer\"],\"style\":{\"position\":\"absolute\",\"bottom\":\"15mm\",\"left\":\"20mm\",\"right\":\"20mm\",\"text-align\":\"center\",\"font-size\":\"8pt\",\"color\":\"rgb(102, 102, 102)\",\"border-top-width\":\"1px\",\"border-top-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"padding-top\":\"10px\"}},{\"selectors\":[\"footer-line\"],\"style\":{\"margin-top\":\"3px\",\"margin-right\":\"0px\",\"margin-bottom\":\"3px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table\",\"style\":{\"width\":\"100%\",\"border-collapse\":\"collapse\",\"margin-top\":\"20px\",\"margin-right\":\"0px\",\"margin-bottom\":\"20px\",\"margin-left\":\"0px\"}},{\"selectors\":[],\"selectorsAdd\":\"table th\",\"style\":{\"background-color\":\"rgb(232, 232, 232)\",\"padding-top\":\"10px\",\"padding-right\":\"10px\",\"padding-bottom\":\"10px\",\"padding-left\":\"10px\",\"text-align\":\"left\",\"font-size\":\"10pt\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\"}},{\"selectors\":[],\"selectorsAdd\":\"table td\",\"style\":{\"padding-top\":\"8px\",\"padding-right\":\"10px\",\"padding-bottom\":\"8px\",\"padding-left\":\"10px\",\"border-top-width\":\"1px\",\"border-right-width\":\"1px\",\"border-bottom-width\":\"1px\",\"border-left-width\":\"1px\",\"border-top-style\":\"solid\",\"border-right-style\":\"solid\",\"border-bottom-style\":\"solid\",\"border-left-style\":\"solid\",\"border-top-color\":\"rgb(204, 204, 204)\",\"border-right-color\":\"rgb(204, 204, 204)\",\"border-bottom-color\":\"rgb(204, 204, 204)\",\"border-left-color\":\"rgb(204, 204, 204)\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"font-size\":\"10pt\"}},{\"selectors\":[\"intro-text\"],\"style\":{\"font-size\":\"10pt\",\"margin-bottom\":\"15px\"}},{\"selectors\":[],\"selectorsAdd\":\"body\",\"style\":{\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"},{\"selectors\":[\"page\"],\"style\":{\"margin-top\":\"0px\",\"margin-right\":\"0px\",\"margin-bottom\":\"0px\",\"margin-left\":\"0px\",\"border-top-width\":\"initial\",\"border-right-width\":\"initial\",\"border-bottom-width\":\"initial\",\"border-left-width\":\"initial\",\"border-top-style\":\"none\",\"border-right-style\":\"none\",\"border-bottom-style\":\"none\",\"border-left-style\":\"none\",\"border-top-color\":\"initial\",\"border-right-color\":\"initial\",\"border-bottom-color\":\"initial\",\"border-left-color\":\"initial\",\"border-image-source\":\"initial\",\"border-image-slice\":\"initial\",\"border-image-width\":\"initial\",\"border-image-outset\":\"initial\",\"border-image-repeat\":\"initial\",\"padding-top\":\"0px\",\"padding-right\":\"0px\",\"padding-bottom\":\"0px\",\"padding-left\":\"0px\"},\"mediaText\":\"print\",\"atRuleType\":\"media\"}]','vertrag',0,1,NULL,1,'2025-10-26 18:37:24','2025-10-26 18:37:24',NULL);
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
  KEY `idx_geplanter_einzug` (`geplanter_einzug`)
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
  `name` varchar(50) NOT NULL,
  `intervall_tage` int NOT NULL,
  `beschreibung` text,
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
-- Final view structure for view `aktive_dokumente`
--

/*!50001 DROP VIEW IF EXISTS `aktive_dokumente`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `aktive_dokumente` AS select `d`.`id` AS `id`,`d`.`name` AS `name`,`d`.`typ` AS `typ`,`d`.`beschreibung` AS `beschreibung`,`d`.`dateiname` AS `dateiname`,`d`.`dateipfad` AS `dateipfad`,`d`.`dateityp` AS `dateityp`,`d`.`dateigroesse` AS `dateigroesse`,`d`.`erstellt_am` AS `erstellt_am`,`d`.`erstellt_von` AS `erstellt_von`,`d`.`parameter` AS `parameter`,`d`.`status` AS `status`,`d`.`downloads` AS `downloads`,`d`.`letzter_download` AS `letzter_download`,`d`.`gueltig_bis` AS `gueltig_bis`,`u`.`username` AS `ersteller_name` from (`dokumente` `d` left join `users` `u` on((`d`.`erstellt_von` = `u`.`id`))) where (`d`.`status` = 'erstellt') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `artikelgruppen_hierarchie`
--

/*!50001 DROP VIEW IF EXISTS `artikelgruppen_hierarchie`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `artikelgruppen_hierarchie` AS select `ag`.`id` AS `id`,`ag`.`name` AS `name`,`ag`.`beschreibung` AS `beschreibung`,`ag`.`parent_id` AS `parent_id`,`ag`.`sortierung` AS `sortierung`,`ag`.`aktiv` AS `aktiv`,`ag`.`icon` AS `icon`,`ag`.`farbe` AS `farbe`,(case when (`ag`.`parent_id` is null) then 'Hauptkategorie' else 'Unterkategorie' end) AS `typ`,(case when (`ag`.`parent_id` is null) then `ag`.`name` else concat(`pag`.`name`,' → ',`ag`.`name`) end) AS `vollstaendiger_name`,`ag`.`erstellt_am` AS `erstellt_am`,`ag`.`aktualisiert_am` AS `aktualisiert_am` from (`artikelgruppen` `ag` left join `artikelgruppen` `pag` on((`ag`.`parent_id` = `pag`.`id`))) order by coalesce(`ag`.`parent_id`,`ag`.`id`),`ag`.`sortierung`,`ag`.`name` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `mitglied_fortschritt_overview`
--

/*!50001 DROP VIEW IF EXISTS `mitglied_fortschritt_overview`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `mitglied_fortschritt_overview` AS select `m`.`mitglied_id` AS `mitglied_id`,concat(`m`.`vorname`,' ',`m`.`nachname`) AS `mitglied_name`,count(distinct `mf`.`fortschritt_id`) AS `gesamt_skills`,sum((case when (`mf`.`status` = 'gemeistert') then 1 else 0 end)) AS `gemeisterte_skills`,round(avg(`mf`.`fortschritt_prozent`),2) AS `durchschnitt_fortschritt`,count(distinct `mz`.`ziel_id`) AS `aktive_ziele`,count(distinct `mm`.`meilenstein_id`) AS `erreichte_meilensteine` from (((`mitglieder` `m` left join `mitglieder_fortschritt` `mf` on((`m`.`mitglied_id` = `mf`.`mitglied_id`))) left join `mitglieder_ziele` `mz` on(((`m`.`mitglied_id` = `mz`.`mitglied_id`) and (`mz`.`status` = 'aktiv')))) left join `mitglieder_meilensteine` `mm` on(((`m`.`mitglied_id` = `mm`.`mitglied_id`) and (`mm`.`erreicht` = true)))) group by `m`.`mitglied_id`,`m`.`vorname`,`m`.`nachname` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `payment_status_overview`
--

/*!50001 DROP VIEW IF EXISTS `payment_status_overview`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `payment_status_overview` AS select `m`.`mitglied_id` AS `mitglied_id`,`m`.`vorname` AS `vorname`,`m`.`nachname` AS `nachname`,`d`.`payment_provider` AS `payment_provider`,(case when (`d`.`payment_provider` = 'stripe_datev') then (select count(0) from `stripe_payment_intents` `spi` where ((`spi`.`mitglied_id` = `m`.`mitglied_id`) and (`spi`.`status` = 'succeeded'))) else (select count(0) from `sepa_mandate` `sm` where ((`sm`.`mitglied_id` = `m`.`mitglied_id`) and (`sm`.`status` = 'aktiv'))) end) AS `active_payment_methods`,(case when (`d`.`payment_provider` = 'stripe_datev') then 'Stripe + DATEV' else 'Manuell SEPA' end) AS `payment_system_name` from (`mitglieder` `m` join `dojo` `d` on((1 = 1))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `top_performer`
--

/*!50001 DROP VIEW IF EXISTS `top_performer`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `top_performer` AS select `m`.`mitglied_id` AS `mitglied_id`,concat(`m`.`vorname`,' ',`m`.`nachname`) AS `mitglied_name`,count((case when (`mf`.`status` = 'gemeistert') then 1 end)) AS `gemeisterte_skills`,round(avg(`mf`.`fortschritt_prozent`),2) AS `durchschnitt_fortschritt`,count((case when (`mm`.`erreicht` = true) then 1 end)) AS `meilensteine` from ((`mitglieder` `m` left join `mitglieder_fortschritt` `mf` on((`m`.`mitglied_id` = `mf`.`mitglied_id`))) left join `mitglieder_meilensteine` `mm` on((`m`.`mitglied_id` = `mm`.`mitglied_id`))) group by `m`.`mitglied_id`,`m`.`vorname`,`m`.`nachname` having (`gemeisterte_skills` > 0) order by `gemeisterte_skills` desc,`durchschnitt_fortschritt` desc limit 10 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_artikel_mit_kategorie`
--

/*!50001 DROP VIEW IF EXISTS `v_artikel_mit_kategorie`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_artikel_mit_kategorie` AS select `a`.`artikel_id` AS `artikel_id`,`a`.`kategorie_id` AS `kategorie_id`,`a`.`name` AS `name`,`a`.`beschreibung` AS `beschreibung`,`a`.`ean_code` AS `ean_code`,`a`.`artikel_nummer` AS `artikel_nummer`,`a`.`einkaufspreis_cent` AS `einkaufspreis_cent`,`a`.`verkaufspreis_cent` AS `verkaufspreis_cent`,`a`.`mwst_prozent` AS `mwst_prozent`,`a`.`lagerbestand` AS `lagerbestand`,`a`.`mindestbestand` AS `mindestbestand`,`a`.`lager_tracking` AS `lager_tracking`,`a`.`bild_url` AS `bild_url`,`a`.`bild_base64` AS `bild_base64`,`a`.`farbe_hex` AS `farbe_hex`,`a`.`aktiv` AS `aktiv`,`a`.`sichtbar_kasse` AS `sichtbar_kasse`,`a`.`erstellt_am` AS `erstellt_am`,`a`.`aktualisiert_am` AS `aktualisiert_am`,`ak`.`name` AS `kategorie_name`,`ak`.`farbe_hex` AS `kategorie_farbe`,`ak`.`icon` AS `kategorie_icon`,(`a`.`verkaufspreis_cent` / 100) AS `verkaufspreis_euro`,(`a`.`einkaufspreis_cent` / 100) AS `einkaufspreis_euro`,(case when (`a`.`lager_tracking` = false) then 'unlimited' when (`a`.`lagerbestand` = 0) then 'out-of-stock' when (`a`.`lagerbestand` <= `a`.`mindestbestand`) then 'low-stock' else 'in-stock' end) AS `lager_status` from (`artikel` `a` join `artikel_kategorien` `ak` on((`a`.`kategorie_id` = `ak`.`kategorie_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_verkauf_statistiken`
--

/*!50001 DROP VIEW IF EXISTS `v_verkauf_statistiken`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_verkauf_statistiken` AS select cast(`v`.`verkauf_datum` as date) AS `datum`,count(0) AS `anzahl_verkaeufe`,sum(`v`.`brutto_gesamt_cent`) AS `umsatz_cent`,sum((case when (`v`.`zahlungsart` = 'bar') then `v`.`brutto_gesamt_cent` else 0 end)) AS `bar_umsatz_cent`,sum((case when (`v`.`zahlungsart` = 'karte') then `v`.`brutto_gesamt_cent` else 0 end)) AS `karte_umsatz_cent`,avg(`v`.`brutto_gesamt_cent`) AS `durchschnitt_cent` from `verkaeufe` `v` where (`v`.`storniert` = false) group by cast(`v`.`verkauf_datum` as date) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-27 12:19:56
