const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Initialisierung: Tabelle erstellen falls nicht vorhanden
const initializeFinanzaemterTable = async () => {
  try {
    // Prüfen ob Tabelle existiert
    const tables = await queryAsync(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'finanzaemter'
    `);

    let needsData = false;
    if (tables[0].count === 0) {

      needsData = true;
      
      // Tabelle erstellen
      await queryAsync(`
        CREATE TABLE finanzaemter (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          ort VARCHAR(255) NOT NULL,
          bundesland VARCHAR(100) NOT NULL,
          plz VARCHAR(10),
          strasse VARCHAR(255),
          telefon VARCHAR(50),
          email VARCHAR(255),
          finanzamtnummer VARCHAR(20),
          is_custom BOOLEAN DEFAULT FALSE COMMENT 'True wenn vom Benutzer hinzugefügt',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_name (name),
          INDEX idx_ort (ort),
          INDEX idx_bundesland (bundesland),
          INDEX idx_search (name, ort, bundesland)
        )
      `);

    } else {
      // Prüfen ob Daten vorhanden sind
      const count = await queryAsync('SELECT COUNT(*) as count FROM finanzaemter');
      if (count[0].count === 0) {

        needsData = true;
      }
    }
    
    if (needsData) {
      
      // ALLE deutschen Finanzämter hinzufügen

      const defaultFinanzaemter = [
        // Baden-Württemberg
        ['Finanzamt Aalen', 'Aalen', 'Baden-Württemberg', '2811'],
        ['Finanzamt Albstadt-Ebingen', 'Albstadt', 'Baden-Württemberg', '2812'],
        ['Finanzamt Balingen', 'Balingen', 'Baden-Württemberg', '2813'],
        ['Finanzamt Böblingen', 'Böblingen', 'Baden-Württemberg', '2814'],
        ['Finanzamt Bruchsal', 'Bruchsal', 'Baden-Württemberg', '2815'],
        ['Finanzamt Bühl', 'Bühl', 'Baden-Württemberg', '2816'],
        ['Finanzamt Calw', 'Calw', 'Baden-Württemberg', '2817'],
        ['Finanzamt Emmendingen', 'Emmendingen', 'Baden-Württemberg', '2818'],
        ['Finanzamt Esslingen', 'Esslingen am Neckar', 'Baden-Württemberg', '2819'],
        ['Finanzamt Freiburg-Stadt', 'Freiburg im Breisgau', 'Baden-Württemberg', '2820'],
        ['Finanzamt Freiburg-Land', 'Freiburg im Breisgau', 'Baden-Württemberg', '2821'],
        ['Finanzamt Freudenstadt', 'Freudenstadt', 'Baden-Württemberg', '2822'],
        ['Finanzamt Göppingen', 'Göppingen', 'Baden-Württemberg', '2823'],
        ['Finanzamt Heidelberg', 'Heidelberg', 'Baden-Württemberg', '2824'],
        ['Finanzamt Heidenheim', 'Heidenheim an der Brenz', 'Baden-Württemberg', '2825'],
        ['Finanzamt Heilbronn', 'Heilbronn', 'Baden-Württemberg', '2826'],
        ['Finanzamt Karlsruhe-Durlach', 'Karlsruhe', 'Baden-Württemberg', '2827'],
        ['Finanzamt Karlsruhe-Stadt', 'Karlsruhe', 'Baden-Württemberg', '2828'],
        ['Finanzamt Kehl', 'Kehl', 'Baden-Württemberg', '2829'],
        ['Finanzamt Konstanz', 'Konstanz', 'Baden-Württemberg', '2830'],
        ['Finanzamt Lahr', 'Lahr/Schwarzwald', 'Baden-Württemberg', '2831'],
        ['Finanzamt Ludwigsburg', 'Ludwigsburg', 'Baden-Württemberg', '2832'],
        ['Finanzamt Mannheim', 'Mannheim', 'Baden-Württemberg', '2833'],
        ['Finanzamt Nürtingen', 'Nürtingen', 'Baden-Württemberg', '2834'],
        ['Finanzamt Offenburg', 'Offenburg', 'Baden-Württemberg', '2835'],
        ['Finanzamt Pforzheim', 'Pforzheim', 'Baden-Württemberg', '2836'],
        ['Finanzamt Rastatt', 'Rastatt', 'Baden-Württemberg', '2837'],
        ['Finanzamt Ravensburg', 'Ravensburg', 'Baden-Württemberg', '2838'],
        ['Finanzamt Reutlingen', 'Reutlingen', 'Baden-Württemberg', '2839'],
        ['Finanzamt Rottweil', 'Rottweil', 'Baden-Württemberg', '2840'],
        ['Finanzamt Schwäbisch Hall', 'Schwäbisch Hall', 'Baden-Württemberg', '2841'],
        ['Finanzamt Singen', 'Singen (Hohentwiel)', 'Baden-Württemberg', '2842'],
        ['Finanzamt Stuttgart I', 'Stuttgart', 'Baden-Württemberg', '2843'],
        ['Finanzamt Stuttgart II', 'Stuttgart', 'Baden-Württemberg', '2844'],
        ['Finanzamt Stuttgart III', 'Stuttgart', 'Baden-Württemberg', '2845'],
        ['Finanzamt Tübingen', 'Tübingen', 'Baden-Württemberg', '2846'],
        ['Finanzamt Tuttlingen', 'Tuttlingen', 'Baden-Württemberg', '2847'],
        ['Finanzamt Ulm', 'Ulm', 'Baden-Württemberg', '2848'],
        ['Finanzamt Villingen-Schwenningen', 'Villingen-Schwenningen', 'Baden-Württemberg', '2849'],
        ['Finanzamt Waiblingen', 'Waiblingen', 'Baden-Württemberg', '2850'],
        
        // Bayern
        ['Finanzamt Amberg', 'Amberg', 'Bayern', '2851'],
        ['Finanzamt Ansbach', 'Ansbach', 'Bayern', '2852'],
        ['Finanzamt Aschaffenburg', 'Aschaffenburg', 'Bayern', '2853'],
        ['Finanzamt Augsburg-Stadt', 'Augsburg', 'Bayern', '2854'],
        ['Finanzamt Augsburg-Land', 'Augsburg', 'Bayern', '2855'],
        ['Finanzamt Bad Kissingen', 'Bad Kissingen', 'Bayern', '2856'],
        ['Finanzamt Bad Tölz-Wolfratshausen', 'Bad Tölz', 'Bayern', '2857'],
        ['Finanzamt Bamberg', 'Bamberg', 'Bayern', '2858'],
        ['Finanzamt Bayreuth', 'Bayreuth', 'Bayern', '2859'],
        ['Finanzamt Coburg', 'Coburg', 'Bayern', '2860'],
        ['Finanzamt Deggendorf', 'Deggendorf', 'Bayern', '2861'],
        ['Finanzamt Dillingen a.d. Donau', 'Dillingen an der Donau', 'Bayern', '2862'],
        ['Finanzamt Dingolfing-Landau', 'Dingolfing', 'Bayern', '2863'],
        ['Finanzamt Donauwörth', 'Donauwörth', 'Bayern', '2864'],
        ['Finanzamt Ebersberg', 'Ebersberg', 'Bayern', '2865'],
        ['Finanzamt Eichstätt', 'Eichstätt', 'Bayern', '2866'],
        ['Finanzamt Erlangen', 'Erlangen', 'Bayern', '2867'],
        ['Finanzamt Freising', 'Freising', 'Bayern', '2868'],
        ['Finanzamt Fürstenfeldbruck', 'Fürstenfeldbruck', 'Bayern', '2869'],
        ['Finanzamt Fürth', 'Fürth', 'Bayern', '2870'],
        ['Finanzamt Garmisch-Partenkirchen', 'Garmisch-Partenkirchen', 'Bayern', '2871'],
        ['Finanzamt Günzburg', 'Günzburg', 'Bayern', '2872'],
        ['Finanzamt Ingolstadt', 'Ingolstadt', 'Bayern', '2873'],
        ['Finanzamt Kaufbeuren', 'Kaufbeuren', 'Bayern', '2874'],
        ['Finanzamt Kempten', 'Kempten (Allgäu)', 'Bayern', '2875'],
        ['Finanzamt Kitzingen', 'Kitzingen', 'Bayern', '2876'],
        ['Finanzamt Kronach', 'Kronach', 'Bayern', '2877'],
        ['Finanzamt Kulmbach', 'Kulmbach', 'Bayern', '2878'],
        ['Finanzamt Landsberg am Lech', 'Landsberg am Lech', 'Bayern', '2879'],
        ['Finanzamt Landshut', 'Landshut', 'Bayern', '2880'],
        ['Finanzamt Lichtenfels', 'Lichtenfels', 'Bayern', '2881'],
        ['Finanzamt Lindau', 'Lindau (Bodensee)', 'Bayern', '2882'],
        ['Finanzamt Mainburg', 'Mainburg', 'Bayern', '2883'],
        ['Finanzamt Memmingen', 'Memmingen', 'Bayern', '2884'],
        ['Finanzamt Mindelheim', 'Mindelheim', 'Bayern', '2885'],
        ['Finanzamt Mühldorf a. Inn', 'Mühldorf am Inn', 'Bayern', '2886'],
        ['Finanzamt München I', 'München', 'Bayern', '2887'],
        ['Finanzamt München II', 'München', 'Bayern', '2888'],
        ['Finanzamt München III', 'München', 'Bayern', '2889'],
        ['Finanzamt München IV', 'München', 'Bayern', '2890'],
        ['Finanzamt München V', 'München', 'Bayern', '2891'],
        ['Finanzamt Neu-Ulm', 'Neu-Ulm', 'Bayern', '2892'],
        ['Finanzamt Neuburg-Schrobenhausen', 'Neuburg an der Donau', 'Bayern', '2893'],
        ['Finanzamt Neumarkt i.d. OPf.', 'Neumarkt in der Oberpfalz', 'Bayern', '2894'],
        ['Finanzamt Neustadt a.d. Aisch', 'Neustadt an der Aisch', 'Bayern', '2895'],
        ['Finanzamt Neustadt a.d. Waldnaab', 'Neustadt an der Waldnaab', 'Bayern', '2896'],
        ['Finanzamt Nürnberg', 'Nürnberg', 'Bayern', '2897'],
        ['Finanzamt Nürnberg-Land', 'Nürnberg', 'Bayern', '2898'],
        ['Finanzamt Passau', 'Passau', 'Bayern', '2899'],
        ['Finanzamt Pfaffenhofen a.d. Ilm', 'Pfaffenhofen an der Ilm', 'Bayern', '2900'],
        ['Finanzamt Regen', 'Regen', 'Bayern', '2901'],
        ['Finanzamt Regensburg', 'Regensburg', 'Bayern', '2902'],
        ['Finanzamt Rosenheim', 'Rosenheim', 'Bayern', '2903'],
        ['Finanzamt Roth', 'Roth', 'Bayern', '2904'],
        ['Finanzamt Rottal-Inn', 'Pfarrkirchen', 'Bayern', '2905'],
        ['Finanzamt Schwandorf', 'Schwandorf', 'Bayern', '2906'],
        ['Finanzamt Schweinfurt', 'Schweinfurt', 'Bayern', '2907'],
        ['Finanzamt Starnberg', 'Starnberg', 'Bayern', '2908'],
        ['Finanzamt Straubing', 'Straubing', 'Bayern', '2909'],
        ['Finanzamt Traunstein', 'Traunstein', 'Bayern', '2910'],
        ['Finanzamt Weiden i.d. OPf.', 'Weiden in der Oberpfalz', 'Bayern', '2911'],
        ['Finanzamt Weilheim-Schongau', 'Weilheim in Oberbayern', 'Bayern', '2912'],
        ['Finanzamt Weißenburg-Gunzenhausen', 'Weißenburg in Bayern', 'Bayern', '2913'],
        ['Finanzamt Würzburg', 'Würzburg', 'Bayern', '2914'],
        
        // Berlin
        ['Finanzamt Berlin I', 'Berlin', 'Berlin', '2915'],
        ['Finanzamt Berlin II', 'Berlin', 'Berlin', '2916'],
        ['Finanzamt Berlin III', 'Berlin', 'Berlin', '2917'],
        ['Finanzamt Berlin IV', 'Berlin', 'Berlin', '2918'],
        ['Finanzamt Berlin V', 'Berlin', 'Berlin', '2919'],
        ['Finanzamt Berlin VI', 'Berlin', 'Berlin', '2920'],
        ['Finanzamt Berlin VII', 'Berlin', 'Berlin', '2921'],
        ['Finanzamt Berlin VIII', 'Berlin', 'Berlin', '2922'],
        ['Finanzamt Berlin IX', 'Berlin', 'Berlin', '2923'],
        ['Finanzamt Berlin X', 'Berlin', 'Berlin', '2924'],
        ['Finanzamt Berlin XI', 'Berlin', 'Berlin', '2925'],
        ['Finanzamt Berlin XII', 'Berlin', 'Berlin', '2926'],
        
        // Brandenburg
        ['Finanzamt Brandenburg an der Havel', 'Brandenburg an der Havel', 'Brandenburg', '2927'],
        ['Finanzamt Cottbus', 'Cottbus', 'Brandenburg', '2928'],
        ['Finanzamt Frankfurt (Oder)', 'Frankfurt (Oder)', 'Brandenburg', '2929'],
        ['Finanzamt Neuruppin', 'Neuruppin', 'Brandenburg', '2930'],
        ['Finanzamt Potsdam', 'Potsdam', 'Brandenburg', '2931'],
        
        // Bremen
        ['Finanzamt Bremen', 'Bremen', 'Bremen', '2932'],
        ['Finanzamt Bremerhaven', 'Bremerhaven', 'Bremen', '2933'],
        
        // Hamburg
        ['Finanzamt Hamburg I', 'Hamburg', 'Hamburg', '2934'],
        ['Finanzamt Hamburg II', 'Hamburg', 'Hamburg', '2935'],
        ['Finanzamt Hamburg III', 'Hamburg', 'Hamburg', '2936'],
        
        // Hessen
        ['Finanzamt Bad Homburg v.d. Höhe', 'Bad Homburg vor der Höhe', 'Hessen', '2937'],
        ['Finanzamt Darmstadt', 'Darmstadt', 'Hessen', '2938'],
        ['Finanzamt Darmstadt-Dieburg', 'Darmstadt', 'Hessen', '2939'],
        ['Finanzamt Frankfurt am Main I', 'Frankfurt am Main', 'Hessen', '2940'],
        ['Finanzamt Frankfurt am Main II', 'Frankfurt am Main', 'Hessen', '2941'],
        ['Finanzamt Frankfurt am Main III', 'Frankfurt am Main', 'Hessen', '2942'],
        ['Finanzamt Frankfurt am Main IV', 'Frankfurt am Main', 'Hessen', '2943'],
        ['Finanzamt Frankfurt am Main V', 'Frankfurt am Main', 'Hessen', '2944'],
        ['Finanzamt Gießen', 'Gießen', 'Hessen', '2945'],
        ['Finanzamt Hanau', 'Hanau', 'Hessen', '2946'],
        ['Finanzamt Kassel', 'Kassel', 'Hessen', '2947'],
        ['Finanzamt Kassel-Land', 'Kassel', 'Hessen', '2948'],
        ['Finanzamt Limburg-Weilburg', 'Limburg an der Lahn', 'Hessen', '2949'],
        ['Finanzamt Marburg-Biedenkopf', 'Marburg', 'Hessen', '2950'],
        ['Finanzamt Offenbach am Main', 'Offenbach am Main', 'Hessen', '2951'],
        ['Finanzamt Rüsselsheim', 'Rüsselsheim am Main', 'Hessen', '2952'],
        ['Finanzamt Schwalm-Eder', 'Schwalmstadt', 'Hessen', '2953'],
        ['Finanzamt Wetzlar', 'Wetzlar', 'Hessen', '2954'],
        ['Finanzamt Wiesbaden', 'Wiesbaden', 'Hessen', '2955'],
        
        // Mecklenburg-Vorpommern
        ['Finanzamt Greifswald', 'Greifswald', 'Mecklenburg-Vorpommern', '2956'],
        ['Finanzamt Neubrandenburg', 'Neubrandenburg', 'Mecklenburg-Vorpommern', '2957'],
        ['Finanzamt Rostock', 'Rostock', 'Mecklenburg-Vorpommern', '2958'],
        ['Finanzamt Schwerin', 'Schwerin', 'Mecklenburg-Vorpommern', '2959'],
        
        // Niedersachsen
        ['Finanzamt Aurich', 'Aurich', 'Niedersachsen', '2960'],
        ['Finanzamt Braunschweig', 'Braunschweig', 'Niedersachsen', '2961'],
        ['Finanzamt Celle', 'Celle', 'Niedersachsen', '2962'],
        ['Finanzamt Cloppenburg', 'Cloppenburg', 'Niedersachsen', '2963'],
        ['Finanzamt Cuxhaven', 'Cuxhaven', 'Niedersachsen', '2964'],
        ['Finanzamt Göttingen', 'Göttingen', 'Niedersachsen', '2965'],
        ['Finanzamt Hannover-Land I', 'Hannover', 'Niedersachsen', '2966'],
        ['Finanzamt Hannover-Land II', 'Hannover', 'Niedersachsen', '2967'],
        ['Finanzamt Hannover-Stadt', 'Hannover', 'Niedersachsen', '2968'],
        ['Finanzamt Hildesheim', 'Hildesheim', 'Niedersachsen', '2969'],
        ['Finanzamt Lingen', 'Lingen (Ems)', 'Niedersachsen', '2970'],
        ['Finanzamt Lüneburg', 'Lüneburg', 'Niedersachsen', '2971'],
        ['Finanzamt Nienburg', 'Nienburg/Weser', 'Niedersachsen', '2972'],
        ['Finanzamt Northeim', 'Northeim', 'Niedersachsen', '2973'],
        ['Finanzamt Oldenburg', 'Oldenburg', 'Niedersachsen', '2974'],
        ['Finanzamt Osnabrück', 'Osnabrück', 'Niedersachsen', '2975'],
        ['Finanzamt Osterholz-Scharmbeck', 'Osterholz-Scharmbeck', 'Niedersachsen', '2976'],
        ['Finanzamt Peine', 'Peine', 'Niedersachsen', '2977'],
        ['Finanzamt Stade', 'Stade', 'Niedersachsen', '2978'],
        ['Finanzamt Uelzen', 'Uelzen', 'Niedersachsen', '2979'],
        ['Finanzamt Verden', 'Verden (Aller)', 'Niedersachsen', '2980'],
        ['Finanzamt Walsrode', 'Walsrode', 'Niedersachsen', '2981'],
        ['Finanzamt Wilhelmshaven', 'Wilhelmshaven', 'Niedersachsen', '2982'],
        ['Finanzamt Wolfenbüttel', 'Wolfenbüttel', 'Niedersachsen', '2983'],
        
        // Nordrhein-Westfalen
        ['Finanzamt Aachen', 'Aachen', 'Nordrhein-Westfalen', '2984'],
        ['Finanzamt Ahlen', 'Ahlen', 'Nordrhein-Westfalen', '2985'],
        ['Finanzamt Arnsberg', 'Arnsberg', 'Nordrhein-Westfalen', '2986'],
        ['Finanzamt Bielefeld', 'Bielefeld', 'Nordrhein-Westfalen', '2987'],
        ['Finanzamt Bochum', 'Bochum', 'Nordrhein-Westfalen', '2988'],
        ['Finanzamt Bonn', 'Bonn', 'Nordrhein-Westfalen', '2989'],
        ['Finanzamt Bottrop', 'Bottrop', 'Nordrhein-Westfalen', '2990'],
        ['Finanzamt Coesfeld', 'Coesfeld', 'Nordrhein-Westfalen', '2991'],
        ['Finanzamt Dinslaken', 'Dinslaken', 'Nordrhein-Westfalen', '2992'],
        ['Finanzamt Düren', 'Düren', 'Nordrhein-Westfalen', '2993'],
        ['Finanzamt Düsseldorf-Altstadt', 'Düsseldorf', 'Nordrhein-Westfalen', '2994'],
        ['Finanzamt Düsseldorf-Benrath', 'Düsseldorf', 'Nordrhein-Westfalen', '2995'],
        ['Finanzamt Düsseldorf-Mettmann', 'Mettmann', 'Nordrhein-Westfalen', '2996'],
        ['Finanzamt Düsseldorf-Süd', 'Düsseldorf', 'Nordrhein-Westfalen', '2997'],
        ['Finanzamt Essen', 'Essen', 'Nordrhein-Westfalen', '2998'],
        ['Finanzamt Gelsenkirchen', 'Gelsenkirchen', 'Nordrhein-Westfalen', '2999'],
        ['Finanzamt Hagen', 'Hagen', 'Nordrhein-Westfalen', '3000'],
        ['Finanzamt Hamm', 'Hamm', 'Nordrhein-Westfalen', '3001'],
        ['Finanzamt Hattingen', 'Hattingen', 'Nordrhein-Westfalen', '3002'],
        ['Finanzamt Herne', 'Herne', 'Nordrhein-Westfalen', '3003'],
        ['Finanzamt Köln-Altstadt', 'Köln', 'Nordrhein-Westfalen', '3004'],
        ['Finanzamt Köln-Mülheim', 'Köln', 'Nordrhein-Westfalen', '3005'],
        ['Finanzamt Köln-Ost', 'Köln', 'Nordrhein-Westfalen', '3006'],
        ['Finanzamt Köln-West', 'Köln', 'Nordrhein-Westfalen', '3007'],
        ['Finanzamt Krefeld', 'Krefeld', 'Nordrhein-Westfalen', '3008'],
        ['Finanzamt Leverkusen', 'Leverkusen', 'Nordrhein-Westfalen', '3009'],
        ['Finanzamt Lüdenscheid', 'Lüdenscheid', 'Nordrhein-Westfalen', '3010'],
        ['Finanzamt Mönchengladbach', 'Mönchengladbach', 'Nordrhein-Westfalen', '3011'],
        ['Finanzamt Mülheim an der Ruhr', 'Mülheim an der Ruhr', 'Nordrhein-Westfalen', '3012'],
        ['Finanzamt Münster', 'Münster', 'Nordrhein-Westfalen', '3013'],
        ['Finanzamt Neuss', 'Neuss', 'Nordrhein-Westfalen', '3014'],
        ['Finanzamt Oberhausen', 'Oberhausen', 'Nordrhein-Westfalen', '3015'],
        ['Finanzamt Paderborn', 'Paderborn', 'Nordrhein-Westfalen', '3016'],
        ['Finanzamt Recklinghausen', 'Recklinghausen', 'Nordrhein-Westfalen', '3017'],
        ['Finanzamt Remscheid', 'Remscheid', 'Nordrhein-Westfalen', '3018'],
        ['Finanzamt Siegen', 'Siegen', 'Nordrhein-Westfalen', '3019'],
        ['Finanzamt Solingen', 'Solingen', 'Nordrhein-Westfalen', '3020'],
        ['Finanzamt Steinfurt', 'Steinfurt', 'Nordrhein-Westfalen', '3021'],
        ['Finanzamt Unna', 'Unna', 'Nordrhein-Westfalen', '3022'],
        ['Finanzamt Velbert', 'Velbert', 'Nordrhein-Westfalen', '3023'],
        ['Finanzamt Wuppertal', 'Wuppertal', 'Nordrhein-Westfalen', '3024'],
        
        // Rheinland-Pfalz
        ['Finanzamt Alzey-Worms', 'Alzey', 'Rheinland-Pfalz', '3025'],
        ['Finanzamt Bad Kreuznach', 'Bad Kreuznach', 'Rheinland-Pfalz', '3026'],
        ['Finanzamt Germersheim', 'Germersheim', 'Rheinland-Pfalz', '3027'],
        ['Finanzamt Kaiserslautern', 'Kaiserslautern', 'Rheinland-Pfalz', '3028'],
        ['Finanzamt Koblenz', 'Koblenz', 'Rheinland-Pfalz', '3029'],
        ['Finanzamt Kusel', 'Kusel', 'Rheinland-Pfalz', '3030'],
        ['Finanzamt Landau', 'Landau in der Pfalz', 'Rheinland-Pfalz', '3031'],
        ['Finanzamt Ludwigshafen am Rhein', 'Ludwigshafen am Rhein', 'Rheinland-Pfalz', '3032'],
        ['Finanzamt Mainz', 'Mainz', 'Rheinland-Pfalz', '3033'],
        ['Finanzamt Neustadt an der Weinstraße', 'Neustadt an der Weinstraße', 'Rheinland-Pfalz', '3034'],
        ['Finanzamt Pirmasens', 'Pirmasens', 'Rheinland-Pfalz', '3035'],
        ['Finanzamt Speyer', 'Speyer', 'Rheinland-Pfalz', '3036'],
        ['Finanzamt Trier', 'Trier', 'Rheinland-Pfalz', '3037'],
        ['Finanzamt Wittlich', 'Wittlich', 'Rheinland-Pfalz', '3038'],
        ['Finanzamt Zweibrücken', 'Zweibrücken', 'Rheinland-Pfalz', '3039'],
        
        // Saarland
        ['Finanzamt Homburg', 'Homburg', 'Saarland', '3040'],
        ['Finanzamt Saarbrücken', 'Saarbrücken', 'Saarland', '3041'],
        ['Finanzamt Saarlouis', 'Saarlouis', 'Saarland', '3042'],
        
        // Sachsen
        ['Finanzamt Annaberg', 'Annaberg-Buchholz', 'Sachsen', '3043'],
        ['Finanzamt Aue-Schwarzenberg', 'Aue', 'Sachsen', '3044'],
        ['Finanzamt Bautzen', 'Bautzen', 'Sachsen', '3045'],
        ['Finanzamt Chemnitz', 'Chemnitz', 'Sachsen', '3046'],
        ['Finanzamt Dresden', 'Dresden', 'Sachsen', '3047'],
        ['Finanzamt Freiberg', 'Freiberg', 'Sachsen', '3048'],
        ['Finanzamt Görlitz', 'Görlitz', 'Sachsen', '3049'],
        ['Finanzamt Leipzig', 'Leipzig', 'Sachsen', '3050'],
        ['Finanzamt Plauen', 'Plauen', 'Sachsen', '3051'],
        ['Finanzamt Zwickau', 'Zwickau', 'Sachsen', '3052'],
        
        // Sachsen-Anhalt
        ['Finanzamt Dessau-Roßlau', 'Dessau-Roßlau', 'Sachsen-Anhalt', '3053'],
        ['Finanzamt Halberstadt', 'Halberstadt', 'Sachsen-Anhalt', '3054'],
        ['Finanzamt Halle (Saale)', 'Halle (Saale)', 'Sachsen-Anhalt', '3055'],
        ['Finanzamt Magdeburg', 'Magdeburg', 'Sachsen-Anhalt', '3056'],
        ['Finanzamt Stendal', 'Stendal', 'Sachsen-Anhalt', '3057'],
        
        // Schleswig-Holstein
        ['Finanzamt Bad Segeberg', 'Bad Segeberg', 'Schleswig-Holstein', '3058'],
        ['Finanzamt Elmshorn', 'Elmshorn', 'Schleswig-Holstein', '3059'],
        ['Finanzamt Flensburg', 'Flensburg', 'Schleswig-Holstein', '3060'],
        ['Finanzamt Itzehoe', 'Itzehoe', 'Schleswig-Holstein', '3061'],
        ['Finanzamt Kiel', 'Kiel', 'Schleswig-Holstein', '3062'],
        ['Finanzamt Lübeck', 'Lübeck', 'Schleswig-Holstein', '3063'],
        ['Finanzamt Neumünster', 'Neumünster', 'Schleswig-Holstein', '3064'],
        ['Finanzamt Norderstedt', 'Norderstedt', 'Schleswig-Holstein', '3065'],
        ['Finanzamt Pinneberg', 'Pinneberg', 'Schleswig-Holstein', '3066'],
        ['Finanzamt Rendsburg', 'Rendsburg', 'Schleswig-Holstein', '3067'],
        ['Finanzamt Schleswig', 'Schleswig', 'Schleswig-Holstein', '3068'],
        
        // Thüringen
        ['Finanzamt Altenburg', 'Altenburg', 'Thüringen', '3069'],
        ['Finanzamt Arnstadt', 'Arnstadt', 'Thüringen', '3070'],
        ['Finanzamt Erfurt', 'Erfurt', 'Thüringen', '3071'],
        ['Finanzamt Gera', 'Gera', 'Thüringen', '3072'],
        ['Finanzamt Gotha', 'Gotha', 'Thüringen', '3073'],
        ['Finanzamt Jena', 'Jena', 'Thüringen', '3074'],
        ['Finanzamt Meiningen', 'Meiningen', 'Thüringen', '3075'],
        ['Finanzamt Mühlhausen', 'Mühlhausen', 'Thüringen', '3076'],
        ['Finanzamt Nordhausen', 'Nordhausen', 'Thüringen', '3077'],
        ['Finanzamt Rudolstadt', 'Rudolstadt', 'Thüringen', '3078'],
        ['Finanzamt Sondershausen', 'Sondershausen', 'Thüringen', '3079'],
        ['Finanzamt Suhl', 'Suhl', 'Thüringen', '3080'],
        ['Finanzamt Weimar', 'Weimar', 'Thüringen', '3081']
      ];
      
      for (const fa of defaultFinanzaemter) {
        // fa ist ein Array: [name, ort, bundesland, finanzamtnummer, plz?, strasse?]
        const values = fa.length === 4 
          ? [fa[0], fa[1], fa[2], null, null, null, null, fa[3]] // Ohne Adresse
          : [fa[0], fa[1], fa[2], fa[4], fa[5], null, null, fa[3]]; // Mit PLZ und Straße
        
        await queryAsync(
          'INSERT INTO finanzaemter (name, ort, bundesland, plz, strasse, telefon, email, finanzamtnummer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          values
        );
      }

    }
  
  } catch (error) {
    logger.error('Fehler bei der Initialisierung der finanzaemter Tabelle:', { error: error });
  }
};

// Beim Laden des Moduls initialisieren
initializeFinanzaemterTable();

// GET - Alle Finanzämter oder Suche
router.get('/', async (req, res) => {
  try {
    const { search, bundesland } = req.query;
    let query = 'SELECT * FROM finanzaemter WHERE 1=1';
    const params = [];

    // Suchfunktion
    if (search) {
      query += ' AND (name LIKE ? OR ort LIKE ? OR bundesland LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter nach Bundesland
    if (bundesland) {
      query += ' AND bundesland = ?';
      params.push(bundesland);
    }

    query += ' ORDER BY bundesland, name';

    const rows = await queryAsync(query, params);
    res.json(rows);
  } catch (error) {
    logger.error('Fehler beim Laden der Finanzämter:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Finanzämter' });
  }
});

// GET - Bundesländer für Filter
router.get('/bundeslaender', async (req, res) => {
  try {
    const rows = await queryAsync('SELECT DISTINCT bundesland FROM finanzaemter ORDER BY bundesland');
    const bundeslaender = rows.map(row => row.bundesland);
    res.json(bundeslaender);
  } catch (error) {
    logger.error('Fehler beim Laden der Bundesländer:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Bundesländer' });
  }
});

// GET - Einzelnes Finanzamt
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await queryAsync('SELECT * FROM finanzaemter WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Finanzamt nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    logger.error('Fehler beim Laden des Finanzamts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden des Finanzamts' });
  }
});

// POST - Neues Finanzamt anlegen
router.post('/', async (req, res) => {
  try {
    const { name, ort, bundesland, plz, strasse, telefon, email, finanzamtnummer } = req.body;

    // Validierung
    if (!name || !ort || !bundesland) {
      return res.status(400).json({ error: 'Name, Ort und Bundesland sind erforderlich' });
    }

    // Prüfen ob Finanzamt bereits existiert
    const existing = await queryAsync(
      'SELECT id FROM finanzaemter WHERE name = ? AND ort = ?',
      [name, ort]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Finanzamt existiert bereits' });
    }

    // Neues Finanzamt einfügen
    const result = await queryAsync(
      `INSERT INTO finanzaemter 
       (name, ort, bundesland, plz, strasse, telefon, email, finanzamtnummer, is_custom) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [name, ort, bundesland, plz, strasse, telefon, email, finanzamtnummer]
    );

    // Zurückgegebenes Finanzamt laden
    const newFinanzamt = await queryAsync('SELECT * FROM finanzaemter WHERE id = ?', [result.insertId]);
    
    res.status(201).json({
      message: 'Finanzamt erfolgreich angelegt',
      finanzamt: newFinanzamt[0]
    });
  } catch (error) {
    logger.error('Fehler beim Anlegen des Finanzamts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Anlegen des Finanzamts' });
  }
});

// PUT - Finanzamt aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ort, bundesland, plz, strasse, telefon, email, finanzamtnummer } = req.body;

    // Validierung
    if (!name || !ort || !bundesland) {
      return res.status(400).json({ error: 'Name, Ort und Bundesland sind erforderlich' });
    }

    // Prüfen ob Finanzamt existiert
    const existing = await queryAsync('SELECT id FROM finanzaemter WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Finanzamt nicht gefunden' });
    }

    // Finanzamt aktualisieren
    await queryAsync(
      `UPDATE finanzaemter SET 
       name = ?, ort = ?, bundesland = ?, plz = ?, strasse = ?, 
       telefon = ?, email = ?, finanzamtnummer = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, ort, bundesland, plz, strasse, telefon, email, finanzamtnummer, id]
    );

    // Aktualisiertes Finanzamt laden
    const updatedFinanzamt = await queryAsync('SELECT * FROM finanzaemter WHERE id = ?', [id]);
    
    res.json({
      message: 'Finanzamt erfolgreich aktualisiert',
      finanzamt: updatedFinanzamt[0]
    });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Finanzamts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Finanzamts' });
  }
});

// DELETE - Finanzamt löschen (nur benutzerdefinierte)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prüfen ob es ein benutzerdefiniertes Finanzamt ist
    const finanzamt = await queryAsync('SELECT is_custom FROM finanzaemter WHERE id = ?', [id]);
    
    if (finanzamt.length === 0) {
      return res.status(404).json({ error: 'Finanzamt nicht gefunden' });
    }

    if (!finanzamt[0].is_custom) {
      return res.status(403).json({ error: 'Standard-Finanzämter können nicht gelöscht werden' });
    }

    // Finanzamt löschen
    await queryAsync('DELETE FROM finanzaemter WHERE id = ?', [id]);
    
    res.json({ message: 'Finanzamt erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen des Finanzamts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Löschen des Finanzamts' });
  }
});

module.exports = router;
