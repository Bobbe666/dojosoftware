import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Package, AlertTriangle, CheckCircle } from 'lucide-react';

const EquipmentManagement = () => {
  const [equipmentList, setEquipmentList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    description: '',
    category: '',
    required: false,
    courses: []
  });

  // Mock-Daten für Equipment
  const mockEquipment = [
    {
      id: 1,
      name: 'Karate-Gi',
      description: 'Weißer Trainingsanzug für Karate',
      category: 'Kleidung',
      required: true,
      courses: [1, 2],
      createdAt: new Date()
    },
    {
      id: 2,
      name: 'Boxhandschuhe',
      description: 'Schutzhandschuhe für Kickboxen',
      category: 'Schutzausrüstung',
      required: true,
      courses: [3, 4],
      createdAt: new Date()
    },
    {
      id: 3,
      name: 'Tatami-Matte',
      description: 'Trainingsmatte für Bodenübungen',
      category: 'Trainingsgerät',
      required: false,
      courses: [1, 2, 3],
      createdAt: new Date()
    },
    {
      id: 4,
      name: 'Schienbeinschoner',
      description: 'Schutz für Schienbeine',
      category: 'Schutzausrüstung',
      required: true,
      courses: [3],
      createdAt: new Date()
    }
  ];

  // Mock-Daten für Kurse
  const mockCourses = [
    { id: 1, name: 'Karate Grundkurs', trainer: 'Meister Schmidt' },
    { id: 2, name: 'Karate Fortgeschritten', trainer: 'Meister Schmidt' },
    { id: 3, name: 'Kickboxen', trainer: 'Trainer Weber' },
    { id: 4, name: 'Selbstverteidigung', trainer: 'Frau Müller' }
  ];

  // Lade Equipment-Daten
  const loadEquipment = async () => {
    setLoading(true);
    try {
      // Simuliere API-Aufruf
      await new Promise(resolve => setTimeout(resolve, 1000));
      setEquipmentList(mockEquipment);
      setCourses(mockCourses);
    } catch (error) {
      console.error('Fehler beim Laden der Equipment-Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  // Füge neues Equipment hinzu
  const addEquipment = async () => {
    try {
      const equipment = {
        ...newEquipment,
        id: Date.now(),
        createdAt: new Date()
      };
      
      setEquipmentList(prev => [...prev, equipment]);
      setNewEquipment({
        name: '',
        description: '',
        category: '',
        required: false,
        courses: []
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
    }
  };

  // Bearbeite Equipment
  const updateEquipment = async (id, updatedData) => {
    try {
      setEquipmentList(prev => 
        prev.map(equipment => 
          equipment.id === id 
            ? { ...equipment, ...updatedData }
            : equipment
        )
      );
      setEditingEquipment(null);
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    }
  };

  // Lösche Equipment
  const deleteEquipment = async (id) => {
    if (window.confirm('Möchten Sie dieses Equipment wirklich löschen?')) {
      try {
        setEquipmentList(prev => prev.filter(equipment => equipment.id !== id));
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
  };

  // Toggle Kurs-Zuweisung
  const toggleCourseAssignment = (equipmentId, courseId) => {
    setEquipmentList(prev => 
      prev.map(equipment => {
        if (equipment.id === equipmentId) {
          const courses = equipment.courses.includes(courseId)
            ? equipment.courses.filter(id => id !== courseId)
            : [...equipment.courses, courseId];
          return { ...equipment, courses };
        }
        return equipment;
      })
    );
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  const categories = ['Kleidung', 'Schutzausrüstung', 'Trainingsgerät', 'Sonstiges'];

  if (loading) {
    return (
      <div className="equipment-management">
        <div className="loading-spinner"></div>
        <span>Lade Equipment-Daten...</span>
      </div>
    );
  }

  return (
    <div className="equipment-management">
      <div className="equipment-header">
        <div className="header-content">
          <Package size={24} />
          <h2>Equipment-Management</h2>
          <p>Verwalte Equipment für Kurse</p>
        </div>
        <button 
          className="add-button"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} />
          Equipment hinzufügen
        </button>
      </div>

      {/* Equipment-Liste */}
      <div className="equipment-list">
        {equipmentList.map(equipment => (
          <div key={equipment.id} className="equipment-card">
            <div className="equipment-main">
              <div className="equipment-info">
                <div className="equipment-header">
                  <h3>{equipment.name}</h3>
                  <div className="equipment-badges">
                    {equipment.required && (
                      <span className="badge required">Erforderlich</span>
                    )}
                    <span className="badge category">{equipment.category}</span>
                  </div>
                </div>
                <p className="equipment-description">{equipment.description}</p>
                <div className="assigned-courses">
                  <strong>Zugewiesene Kurse:</strong>
                  <div className="course-tags">
                    {equipment.courses.map(courseId => {
                      const course = courses.find(c => c.id === courseId);
                      return course ? (
                        <span key={courseId} className="course-tag">
                          {course.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
              <div className="equipment-actions">
                <button 
                  className="action-button edit"
                  onClick={() => setEditingEquipment(equipment)}
                >
                  <Edit size={16} />
                </button>
                <button 
                  className="action-button delete"
                  onClick={() => deleteEquipment(equipment.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Neues Equipment hinzufügen</h3>
              <button 
                className="close-button"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text"
                  value={newEquipment.name}
                  onChange={(e) => setNewEquipment(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="z.B. Karate-Gi"
                />
              </div>
              <div className="form-group">
                <label>Beschreibung</label>
                <textarea 
                  value={newEquipment.description}
                  onChange={(e) => setNewEquipment(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beschreibung des Equipments"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Kategorie</label>
                <select 
                  value={newEquipment.category}
                  onChange={(e) => setNewEquipment(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">Kategorie wählen</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input 
                    type="checkbox"
                    checked={newEquipment.required}
                    onChange={(e) => setNewEquipment(prev => ({ ...prev, required: e.target.checked }))}
                  />
                  Erforderlich
                </label>
              </div>
              <div className="form-group">
                <label>Kurse zuweisen</label>
                <div className="course-checkboxes">
                  {courses.map(course => (
                    <label key={course.id} className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={newEquipment.courses.includes(course.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEquipment(prev => ({ 
                              ...prev, 
                              courses: [...prev.courses, course.id] 
                            }));
                          } else {
                            setNewEquipment(prev => ({ 
                              ...prev, 
                              courses: prev.courses.filter(id => id !== course.id) 
                            }));
                          }
                        }}
                      />
                      {course.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowAddModal(false)}
              >
                Abbrechen
              </button>
              <button 
                className="btn btn-primary"
                onClick={addEquipment}
                disabled={!newEquipment.name || !newEquipment.category}
              >
                <Save size={16} />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {editingEquipment && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Equipment bearbeiten</h3>
              <button 
                className="close-button"
                onClick={() => setEditingEquipment(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text"
                  value={editingEquipment.name}
                  onChange={(e) => setEditingEquipment(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Beschreibung</label>
                <textarea 
                  value={editingEquipment.description}
                  onChange={(e) => setEditingEquipment(prev => ({ ...prev, description: e.target.value }))}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Kategorie</label>
                <select 
                  value={editingEquipment.category}
                  onChange={(e) => setEditingEquipment(prev => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input 
                    type="checkbox"
                    checked={editingEquipment.required}
                    onChange={(e) => setEditingEquipment(prev => ({ ...prev, required: e.target.checked }))}
                  />
                  Erforderlich
                </label>
              </div>
              <div className="form-group">
                <label>Kurse zuweisen</label>
                <div className="course-checkboxes">
                  {courses.map(course => (
                    <label key={course.id} className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={editingEquipment.courses.includes(course.id)}
                        onChange={(e) => toggleCourseAssignment(editingEquipment.id, course.id)}
                      />
                      {course.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setEditingEquipment(null)}
              >
                Abbrechen
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => updateEquipment(editingEquipment.id, editingEquipment)}
              >
                <Save size={16} />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentManagement;
