import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Clock, CheckCircle, User, X, Camera, QrCode, 
  Users, Calendar, ArrowRight, Plus, Check
} from 'lucide-react';

const CourseSelectionCheckin = () => {
  // State Management
  const [mode, setMode] = useState('touch');
  const [mitglieder, setMitglieder] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [kurseHeute, setKurseHeute] = useState([]);
  const [checkinHistory, setCheckinHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Course Selection Modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState([]);
  
  // QR Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  // API-Daten laden
  useEffect(() => {
    loadMitglieder();
    loadKurseHeute();
    loadCheckinHistory();
  }, []);

  const loadMitglieder = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/mitglieder`);
      if (response.ok) {
        const data = await response.json();
        setMitglieder(data.map(m => ({
          id: m.mitglied_id,
          vorname: m.vorname,
          nachname: m.nachname,
          foto: m.profilbild || '👤',
          status: m.status || 'aktiv',
          mitgliedsnummer: m.mitgliedsnummer
        })));
      } else {
        console.error('Fehler beim Laden der Mitglieder');
        setMitglieder([]);
      }
    } catch (err) {
      console.error('Netzwerkfehler beim Laden der Mitglieder:', err);
      setMitglieder([]);
    }
  };

  const loadKurseHeute = async () => {
    try {
      const heute = new Date().toISOString().split('T')[0];
      const response = await fetch(`${config.apiBaseUrl}/kurse/heute?datum=${heute}`);
      if (response.ok) {
        const data = await response.json();
        setKurseHeute(data.map(k => ({
          id: k.kurs_id,
          name: k.name,
          zeit: `${k.startzeit}-${k.endzeit}`,
          trainer: k.trainer_name || 'Trainer',
          farbe: k.farbe || 'bg-blue-500',
          teilnehmer: k.anmeldungen || 0,
          max_teilnehmer: k.max_teilnehmer || 20
        })));
      } else {
        console.error('Fehler beim Laden der heutigen Kurse');
        setKurseHeute([]);
      }
    } catch (err) {
      console.error('Netzwerkfehler beim Laden der Kurse:', err);
      setKurseHeute([]);
    }
  };

  const loadCheckinHistory = () => {
    setCheckinHistory([]);
  };

  // Gefilterte Mitglieder für Touch-Mode
  const filteredMitglieder = useMemo(() => {
    return mitglieder.filter(mitglied => 
      mitglied.status === 'aktiv' && 
      (mitglied.vorname.toLowerCase().includes(searchTerm.toLowerCase()) ||
       mitglied.nachname.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [mitglieder, searchTerm]);

  // Check ob Mitglied bereits für Kurs angemeldet
  const isRegisteredForCourse = (memberId, courseId) => {
    return checkinHistory.some(
      checkin => checkin.memberId === memberId && 
                 checkin.courses.some(c => c.id === courseId)
    );
  };

  // Mitglied auswählen und Kurs-Modal öffnen
  const selectMember = (member) => {
    setSelectedMember(member);
    setSelectedCourses([]);
    setShowCourseModal(true);
    setError('');
  };

  // Kurs-Auswahl toggle
  const toggleCourseSelection = (course) => {
    setSelectedCourses(prev => {
      const isSelected = prev.some(c => c.id === course.id);
      if (isSelected) {
        return prev.filter(c => c.id !== course.id);
      } else {
        return [...prev, course];
      }
    });
  };

  // Check-in bestätigen
  const confirmCheckin = async () => {
    if (selectedCourses.length === 0) {
      setError('Bitte wählen Sie mindestens einen Kurs aus');
      return;
    }

    setLoading(true);
    try {
      // API Call für alle ausgewählten Kurse
      // await Promise.all(selectedCourses.map(course => 
      //   axios.post('/api/checkin', {
      //     mitglied_id: selectedMember.id,
      //     kurs_id: course.id,
      //     checkin_method: mode === 'touch' ? 'touch' : 'qr_code'
      //   })
      // ));

      const checkinData = {
        memberId: selectedMember.id,
        member: selectedMember,
        courses: selectedCourses,
        checkinTime: new Date(),
        method: mode === 'touch' ? 'touch' : 'qr_code'
      };

      setCheckinHistory(prev => [checkinData, ...prev]);
      
      // Modal schließen und Erfolg anzeigen
      setShowCourseModal(false);
      setSelectedMember(null);
      setSelectedCourses([]);
      
      // Bei QR-Mode weiterscannen
      if (mode === 'qr' && isScanning) {
        setTimeout(() => {
          simulateQRScan();
        }, 1000);
      }

    } catch (err) {
      setError('Check-in fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // QR Scanner Funktionen
  const startScanning = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
        setTimeout(simulateQRScan, 2000);
      }
    } catch (err) {
      setError('Kamera-Zugriff verweigert');
    }
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setScanResult(null);
  };

  const simulateQRScan = () => {
    const randomMember = mitglieder[Math.floor(Math.random() * mitglieder.length)];
    setScanResult(randomMember);
    selectMember(randomMember);
  };

  // Course Selection Modal Component
  const CourseSelectionModal = () => {
    if (!showCourseModal || !selectedMember) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{selectedMember.foto}</div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedMember.vorname} {selectedMember.nachname}
                  </h2>
                  <p className="text-gray-600">Kurs-Auswahl für heute</p>
                </div>
              </div>
              <button
                onClick={() => setShowCourseModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Course List */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="text-blue-500" size={20} />
              Verfügbare Kurse heute
            </h3>
            
            <div className="space-y-3">
              {kurseHeute.map(course => {
                const isSelected = selectedCourses.some(c => c.id === course.id);
                const isRegistered = isRegisteredForCourse(selectedMember.id, course.id);
                const isFull = course.teilnehmer >= course.max_teilnehmer;
                
                return (
                  <div
                    key={course.id}
                    onClick={() => !isRegistered && !isFull && toggleCourseSelection(course)}
                    className={`
                      relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                      ${isSelected 
                        ? 'border-green-500 bg-green-50' 
                        : isRegistered
                        ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                        : isFull
                        ? 'border-red-300 bg-red-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${course.farbe}`}></div>
                        <div>
                          <h4 className={`font-semibold ${
                            isRegistered || isFull ? 'text-gray-500' : 'text-gray-800'
                          }`}>
                            {course.name}
                          </h4>
                          <p className={`text-sm ${
                            isRegistered || isFull ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {course.zeit} • {course.trainer}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Teilnehmer-Info */}
                        <div className={`text-sm ${
                          isFull ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {course.teilnehmer}/{course.max_teilnehmer}
                        </div>
                        
                        {/* Status Icons */}
                        {isRegistered ? (
                          <div className="bg-gray-400 text-white p-2 rounded-full">
                            <Check size={16} />
                          </div>
                        ) : isFull ? (
                          <div className="bg-red-500 text-white p-2 rounded-full">
                            <X size={16} />
                          </div>
                        ) : isSelected ? (
                          <div className="bg-green-500 text-white p-2 rounded-full">
                            <Check size={16} />
                          </div>
                        ) : (
                          <div className="border-2 border-gray-300 p-2 rounded-full">
                            <Plus size={16} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Status Labels */}
                    {isRegistered && (
                      <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
                        Bereits angemeldet
                      </div>
                    )}
                    {isFull && !isRegistered && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        Ausgebucht
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Courses Summary */}
            {selectedCourses.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                <h4 className="font-semibold text-green-800 mb-2">
                  Ausgewählte Kurse ({selectedCourses.length}):
                </h4>
                <div className="space-y-1">
                  {selectedCourses.map(course => (
                    <div key={course.id} className="text-sm text-green-700">
                      • {course.name} ({course.zeit})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={() => setShowCourseModal(false)}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
            >
              Abbrechen
            </button>
            <button
              onClick={confirmCheckin}
              disabled={selectedCourses.length === 0 || loading}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle size={20} />
                  Anmelden ({selectedCourses.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <CheckCircle className="text-blue-500" size={36} />
              Check-in mit Kurs-Auswahl
            </h1>
            
            {/* Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-2">
              <button
                onClick={() => {
                  setMode('touch');
                  stopScanning();
                  setError('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                  mode === 'touch' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <User size={20} />
                Touch
              </button>
              <button
                onClick={() => {
                  setMode('qr');
                  setError('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                  mode === 'qr' 
                    ? 'bg-purple-500 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <QrCode size={20} />
                QR-Code
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            1️⃣ Mitglied auswählen → 2️⃣ Kurse für heute wählen → 3️⃣ Anmelden
          </div>
        </div>

        {/* Error Display */}
        {error && !showCourseModal && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Main Interface */}
          <div className="lg:col-span-2">
            {mode === 'touch' ? (
              <div className="space-y-6">
                {/* Suchfeld */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
                    <input
                      type="text"
                      placeholder="Mitglied suchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 text-xl border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={24} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mitglieder Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredMitglieder.map(mitglied => (
                    <button
                      key={mitglied.id}
                      onClick={() => selectMember(mitglied)}
                      className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 active:scale-95 min-h-[140px] flex flex-col items-center justify-center"
                    >
                      <div className="text-4xl mb-2 w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        {mitglied.foto}
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-gray-800">{mitglied.vorname}</div>
                        <div className="text-sm text-gray-600">{mitglied.nachname}</div>
                      </div>
                      <ArrowRight className="mt-2 text-blue-500" size={20} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* QR Scanner */
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Camera className="text-purple-500" size={24} />
                  QR-Code Scanner
                </h2>
                
                <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                  {!isScanning ? (
                    <div className="aspect-video flex flex-col items-center justify-center p-8">
                      <QrCode className="text-gray-400 mb-4" size={64} />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">QR-Code scannen</h3>
                      <p className="text-gray-500 text-center mb-6">
                        QR-Code scannen für Kurs-Auswahl
                      </p>
                      <button
                        onClick={startScanning}
                        className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
                      >
                        <Camera size={20} />
                        Scanner starten
                      </button>
                    </div>
                  ) : (
                    <div className="aspect-video relative">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="border-4 border-purple-500 border-dashed w-64 h-64 rounded-xl flex items-center justify-center">
                          <div className="text-white text-center">
                            <QrCode size={48} className="mx-auto mb-2" />
                            <p className="font-semibold">QR-Code positionieren</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={stopScanning}
                        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Check-in History */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="text-green-500" size={24} />
              Heutige Anmeldungen
            </h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {checkinHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>Noch keine Anmeldungen heute</p>
                </div>
              ) : (
                checkinHistory.map((checkin, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">{checkin.member.foto}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {checkin.member.vorname} {checkin.member.nachname}
                        </div>
                        <div className="text-sm text-gray-600">
                          {checkin.checkinTime.toLocaleTimeString('de-DE', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="pl-11 space-y-1">
                      {checkin.courses.map(course => (
                        <div key={course.id} className="text-xs text-gray-600 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${course.farbe}`}></div>
                          {course.name} ({course.zeit})
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Course Selection Modal */}
        <CourseSelectionModal />
      </div>
    </div>
  );
};

export default CourseSelectionModal;