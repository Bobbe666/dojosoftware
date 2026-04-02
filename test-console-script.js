// 🔍 DOJO FILTER TEST SCRIPT
// Kopiere diesen Code und füge ihn in die Safari Developer Console ein
// (Safari → Entwickler → JavaScript-Konsole anzeigen)

(async function testDojoFilter() {
    console.log('🚀 Starting Dojo Filter Tests...');

    const API_BASE = 'http://localhost:5001';
    const DOJO_IDS = '2,3';

    function cacheBust() {
        return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    async function makeRequest(url, label) {
        const bustUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + cacheBust();
        console.log(`\n🔍 Testing: ${label}`);
        console.log(`   URL: ${bustUrl}`);

        try {
            const response = await fetch(bustUrl, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error(`   ❌ HTTP ${response.status}: ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            return null;
        }
    }

    function analyzeData(data, label) {
        if (!data) {
            console.error(`   ⚠️  No data received`);
            return null;
        }

        const items = Array.isArray(data) ? data : (data.data || []);
        const demo1Items = items.filter(item => item.dojo_id === 4 || item.dojoname === 'demo');
        const dojo2Items = items.filter(item => item.dojo_id === 2);
        const dojo3Items = items.filter(item => item.dojo_id === 3);

        console.log(`   📊 Results for ${label}:`);
        console.log(`      Total items: ${items.length}`);
        console.log(`      Dojo 2: ${dojo2Items.length}`);
        console.log(`      Dojo 3: ${dojo3Items.length}`);
        console.log(`      Demo1 (dojo_id=4): ${demo1Items.length}`);

        if (demo1Items.length > 0) {
            console.error(`   ❌ FEHLER: Demo1 Daten gefunden!`);
            console.log(`      Demo1 Items:`, demo1Items);
            return false;
        } else {
            console.log(`   ✅ SUCCESS: Keine Demo1 Daten`);
            return true;
        }
    }

    // Test 1: Prüfungen
    const pruefungen = await makeRequest(
        `${API_BASE}/api/pruefungen?status=geplant&dojo_ids=${DOJO_IDS}`,
        'Geplante Prüfungen'
    );
    const test1 = analyzeData(pruefungen, 'Prüfungen');

    // Test 2: Termine
    const termine = await makeRequest(
        `${API_BASE}/api/pruefungen/termine?dojo_ids=${DOJO_IDS}`,
        'Prüfungstermine'
    );
    const test2 = analyzeData(termine, 'Termine');

    // Test 3: Kandidaten
    const kandidaten = await makeRequest(
        `${API_BASE}/api/pruefungen/kandidaten?dojo_ids=${DOJO_IDS}`,
        'Prüfungskandidaten'
    );
    const test3 = analyzeData(kandidaten, 'Kandidaten');

    // Summary
    console.log('\n\n📝 ZUSAMMENFASSUNG:');
    console.log('==================');
    console.log(`Prüfungen: ${test1 ? '✅ OK' : '❌ FEHLER'}`);
    console.log(`Termine: ${test2 ? '✅ OK' : '❌ FEHLER'}`);
    console.log(`Kandidaten: ${test3 ? '✅ OK' : '❌ FEHLER'}`);

    if (test1 && test2 && test3) {
        console.log('\n🎉 ALLE TESTS ERFOLGREICH! Backend funktioniert korrekt.');
        console.log('   Problem ist nur Browser-Cache im Dashboard.');
    } else {
        console.log('\n⚠️  BACKEND PROBLEM! Demo1 Daten werden nicht gefiltert.');
    }
})();
