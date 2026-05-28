import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { databases, DATABASE_ID, NAMAZ_COLLECTION_ID, ID, Query } from '../lib/appwrite';
import { getTodayDate } from '../lib/utils';
import { Check, Moon, Sun, CloudSun, Sunset } from 'lucide-react';

const NAMAZ_TYPES = [
  { id: 'fajar', name: 'Fajar', icon: Sun },
  { id: 'zohar', name: 'Zohar', icon: Sun },
  { id: 'asar', name: 'Asar', icon: CloudSun },
  { id: 'maghrib', name: 'Maghrib', icon: Sunset },
  { id: 'isha', name: 'Isha', icon: Moon }
];

export default function Namaz() {
  const { user } = useAuth();
  const [namazRecords, setNamazRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, namazId: null, namazName: '' });

  useEffect(() => {
    fetchNamazRecords();
  }, []);

  async function fetchNamazRecords() {
    try {
      const today = getTodayDate();
      const response = await databases.listDocuments(
        DATABASE_ID,
        NAMAZ_COLLECTION_ID,
        [
          Query.equal('userId', user.$id),
          Query.equal('date', today)
        ]
      );
      setNamazRecords(response.documents);
    } catch (error) {
      console.error('Error fetching namaz records:', error);
      // Fallback to localStorage if database fails
      const localData = localStorage.getItem(`namaz_${user.$id}_${getTodayDate()}`);
      if (localData) {
        setNamazRecords(JSON.parse(localData));
      }
    } finally {
      setLoading(false);
    }
  }

  function getNamazStatus(namazId) {
    const record = namazRecords.find(r => r.namazId === namazId);
    return record ? record.completed : false;
  }

  function getNamazRecordId(namazId) {
    const record = namazRecords.find(r => r.namazId === namazId);
    return record ? record.$id : null;
  }

  async function handleNamazClick(namazId, namazName) {
    const currentStatus = getNamazStatus(namazId);
    
    if (currentStatus) {
      // If already completed, just toggle it off without confirmation
      await toggleNamaz(namazId, currentStatus);
    } else {
      // If not completed, show confirmation dialog
      setConfirmDialog({ show: true, namazId, namazName });
    }
  }

  async function toggleNamaz(namazId, currentStatus) {
    const newStatus = !currentStatus;
    const today = getTodayDate();
    
    // Update local state immediately for better UX
    const updatedRecords = [...namazRecords];
    const existingIndex = updatedRecords.findIndex(r => r.namazId === namazId);
    
    if (existingIndex >= 0) {
      updatedRecords[existingIndex].completed = newStatus;
    } else {
      updatedRecords.push({
        $id: ID.unique(),
        userId: user.$id,
        namazId: namazId,
        completed: newStatus,
        date: today,
        createdAt: new Date().toISOString()
      });
    }
    
    setNamazRecords(updatedRecords);
    
    // Save to localStorage immediately
    const storageKey = `namaz_${user.$id}_${today}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
    
    // Save to database in background without blocking UI
    const recordId = getNamazRecordId(namazId);
    if (recordId) {
      databases.updateDocument(
        DATABASE_ID,
        NAMAZ_COLLECTION_ID,
        recordId,
        { completed: newStatus }
      ).catch(error => console.error('Error saving to database:', error));
    } else {
      databases.createDocument(
        DATABASE_ID,
        NAMAZ_COLLECTION_ID,
        ID.unique(),
        {
          userId: user.$id,
          namazId: namazId,
          completed: newStatus,
          date: today,
          createdAt: new Date().toISOString()
        }
      ).catch(error => console.error('Error saving to database:', error));
    }
  }

  async function handleConfirm() {
    await toggleNamaz(confirmDialog.namazId, false);
    setConfirmDialog({ show: false, namazId: null, namazName: '' });
  }

  function handleCancel() {
    setConfirmDialog({ show: false, namazId: null, namazName: '' });
  }

  const completedCount = namazRecords.filter(r => r.completed).length;
  const totalCount = NAMAZ_TYPES.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="mobile-container px-4 py-8 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Namaz Tracker</h1>
        <p className="text-[#7b8fa1] dark:text-[#a7c7e7]/80 text-xs mt-1">{getTodayDate()}</p>
      </div>

      <div className="glass-card rounded-2xl p-5 mb-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-gray-800 dark:text-white">Today's Progress</span>
          </div>
          <span className="text-purple-600 dark:text-purple-400 font-bold">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 shadow-lg"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#a0aec0] dark:text-[#a7c7e7]">Loading namaz records...</div>
      ) : (
        <div className="space-y-3">
          {NAMAZ_TYPES.map((namaz) => {
            const isCompleted = getNamazStatus(namaz.id);
            return (
              <div
                key={namaz.id}
                onClick={() => handleNamazClick(namaz.id, namaz.name)}
                className={`glass-card rounded-xl p-4 flex items-center gap-3 transition-all border-l-4 cursor-pointer ${
                  isCompleted
                    ? 'border-emerald-400 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20'
                    : 'border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20'
                }`}
              >
                <button
                  className={`p-2 rounded-full transition-all shadow-md ${
                    isCompleted
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
                      : 'bg-gradient-to-br from-purple-400 to-pink-500 text-white hover:scale-110'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <namaz.icon className="w-5 h-5" />}
                </button>
                <span
                  className={`flex-1 font-semibold text-lg ${
                    isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'
                  }`}
                >
                  {namaz.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-[#232946] dark:text-[#eaeaea] mb-2">
              Confirm Namaz
            </h3>
            <p className="text-[#7b8fa1] dark:text-[#a7c7e7]/80 mb-6">
              Did you really offer {confirmDialog.namazName} namaz?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl font-semibold hover:scale-105 transition-transform"
              >
                No
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:scale-105 transition-transform shadow-lg"
              >
                Yes, I did
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
