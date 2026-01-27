import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Package, AlertTriangle, Info, Calendar } from 'lucide-react';
import MemberHeader from './MemberHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';

const EquipmentChecklist = () => {
  const [todayCourses, setTodayCourses] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [checkedEquipment, setCheckedEquipment] = useState({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Generische Equipment-Liste (nicht kursspezifisch, da keine Backend-Unterstützung)
  const genericEquipment = [
    {
      id: 1,
      name: 'Trainingskleidung (Gi/Anzug)',
      description: 'Saubere Trainingskleidung für dein Training',
      category: 'Kleidung',
      required: true
    },
    {
      id: 2,
      name: 'Handtuch',
      description: 'Handtuch für nach dem Training',
      category: 'Hygiene',
      required: false
    },
    {
      id: 3,
      name: 'Wasserflasche',
      description: 'Ausreichend Wasser für das Training',
      category: 'Verpflegung',
      required: true
    },
    {
      id: 4,
      name: 'Schutzausrüstung',
      description: 'Falls für deinen Kurs erforderlich (z.B. Handschuhe, Schienbeinschoner)',
      category: 'Schutzausrüstung',
      required: false
    }
  ];

  // Lade heutige Kurse von der API
  const loadTodayData = async () => {
    setLoading(true);
    try {
      // 1. Lade Mitglieds-ID
      if (!user?.email) {
        console.error('Kein User angemeldet');
        setLoading(false);
        return;
      }

      const memberResponse = await axios.get(`/mitglieder/by-email/${encodeURIComponent(user.email)}`);
      const mitgliedId = memberResponse.data.mitglied_id;

      // 2. Lade alle kommenden Termine
      const termineResponse = await axios.get(`/stundenplan/member/${mitgliedId}/termine`);
      const allTermine = termineResponse.data;

      // 3. Filtere nur heutige Termine
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todayTermine = allTermine.filter(termin => termin.datum === today);

      // 4. Formatiere für die Anzeige
      const formattedCourses = todayTermine.map(termin => ({
        id: termin.stundenplan_id,
        kurs_name: termin.title,
        trainer_name: termin.trainer,
        uhrzeit: termin.zeit,
        raum: termin.raum,
        datum: termin.datum
      }));

      setTodayCourses(formattedCourses);
      setEquipmentList(genericEquipment);

      // Lade gespeicherte Checkbox-States
      const savedChecks = localStorage.getItem('equipment-checklist');
      if (savedChecks) {
        setCheckedEquipment(JSON.parse(savedChecks));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Kursdaten:', error);
      setTodayCourses([]);
      setEquipmentList(genericEquipment);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Equipment Checkbox
  const toggleEquipment = (equipmentId) => {
    setCheckedEquipment(prev => {
      const newState = {
        ...prev,
        [equipmentId]: !prev[equipmentId]
      };
      
      // Speichere in localStorage
      localStorage.setItem('equipment-checklist', JSON.stringify(newState));
      return newState;
    });
  };

  // Berechne Fortschritt (alle Equipment-Items)
  const getProgress = () => {
    const checkedCount = equipmentList.filter(equipment => checkedEquipment[equipment.id]).length;
    return {
      checked: checkedCount,
      total: equipmentList.length,
      percentage: equipmentList.length > 0 ? Math.round((checkedCount / equipmentList.length) * 100) : 100
    };
  };

  // Gruppiere Equipment nach Kategorien
  const groupEquipmentByCategory = (equipment) => {
    return equipment.reduce((groups, item) => {
      const category = item.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {});
  };

  useEffect(() => {
    loadTodayData();
  }, [user]);

  const progress = getProgress();
  const equipmentByCategory = groupEquipmentByCategory(equipmentList);

  if (loading) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="dashboard-content">
          <div className="equipment-checklist-loading">
            <div className="loading-spinner"></div>
            <span>Lade Equipment-Checkliste...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content">
        <div className="equipment-checklist">
          {/* Header */}
          <div className="checklist-header">
            <div className="header-content">
              <Package size={24} />
              <h1>Equipment-Checkliste</h1>
              <p>Was brauche ich heute für mein Training?</p>
            </div>
          </div>

          {/* Heutige Kurse */}
          {todayCourses.length > 0 ? (
            <>
              {/* Fortschrittsanzeige */}
              <div className="progress-section">
                <div className="progress-header">
                  <h2>Heutige Vorbereitung</h2>
                  <div className="progress-badge">
                    {progress.checked}/{progress.total} ✓
                  </div>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {progress.percentage === 100 ? (
                    <span className="complete">🎉 Alles bereit für dein Training!</span>
                  ) : (
                    <span>Noch {progress.total - progress.checked} Gegenstände fehlen</span>
                  )}
                </div>
              </div>

              {/* Heutige Kurse */}
              <div className="today-courses">
                <h3>
                  <Calendar size={20} />
                  Heutige Kurse
                </h3>
                <div className="courses-list">
                  {todayCourses.map(course => (
                    <div key={course.id} className="course-item">
                      <div className="course-info">
                        <h4>{course.kurs_name}</h4>
                        <div className="course-details">
                          <span>👨‍🏫 {course.trainer_name}</span>
                          <span>🕐 {course.uhrzeit}</span>
                          <span>📍 {course.raum}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment nach Kategorien */}
              <div className="equipment-categories">
                <h3>
                  <Package size={20} />
                  Benötigtes Equipment
                </h3>
                {Object.entries(equipmentByCategory).map(([category, equipment]) => (
                  <div key={category} className="equipment-category">
                    <h4>{category}</h4>
                    <div className="equipment-items">
                      {equipment.map(item => (
                        <div
                          key={item.id}
                          className={`equipment-item ${checkedEquipment[item.id] ? 'checked' : ''}`}
                        >
                          <button
                            className="check-button"
                            onClick={() => toggleEquipment(item.id)}
                          >
                            {checkedEquipment[item.id] ? (
                              <CheckCircle size={20} />
                            ) : (
                              <Circle size={20} />
                            )}
                          </button>
                          <div className="equipment-info">
                            <h5>{item.name}</h5>
                            <p>{item.description}</p>
                            {item.required && (
                              <span className="required-badge">Empfohlen</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-courses">
              <Info size={48} />
              <h3>Keine Kurse heute</h3>
              <p>Du hast heute keine geplanten Kurse. Zeit für ein freies Training! 💪</p>
            </div>
          )}

          {/* Tipps */}
          <div className="equipment-tips">
            <h3>💡 Tipps</h3>
            <ul>
              <li>Kontrolliere dein Equipment rechtzeitig vor dem Training</li>
              <li>Diese Liste zeigt empfohlenes Equipment für dein Training</li>
              <li>Bei Fragen zum benötigten Equipment wende dich an deinen Trainer</li>
              <li>Deine Checkliste wird automatisch gespeichert</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentChecklist;
