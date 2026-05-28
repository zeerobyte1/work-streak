import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Trophy, Info, Sparkles, X, Trash2, AlertTriangle, Camera, Upload } from 'lucide-react';
import { databases, storage, account, DATABASE_ID, DAILY_TASKS_COLLECTION_ID, HABITS_COLLECTION_ID, HABIT_LOGS_COLLECTION_ID, FUTURE_TASKS_COLLECTION_ID, STORAGE_BUCKET_ID, ID, Query } from '../lib/appwrite';
import { formatDate } from '../lib/utils';
import {
  User,
  CheckSquare,
  Flame,
  Calendar,
  TrendingUp,
  Award,
  Target,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function Profile() {
  const { user, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    dailyTasksCompleted: 0,
    dailyTasksTotal: 0,
    streak: 0,
    habitsTotal: 0,
    habitsCompleted: 0,
    habitsContinuing: 0,
    futureTasksTotal: 0,
    futureTasksCompleted: 0,
    futureTasksContinuing: 0
  });
  const [history, setHistory] = useState([]);
  const [futureTasksHistory, setFutureTasksHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showFutureHistory, setShowFutureHistory] = useState(false);
  const [showAchievementsInfo, setShowAchievementsInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchStats();
    loadProfileImage();
  }, []);

  async function loadProfileImage() {
    try {
      const userData = await account.get();
      if (userData.prefs?.profileImage) {
        setProfileImage(userData.prefs.profileImage);
      }
    } catch (error) {
      console.error('Error loading profile image:', error);
    }
  }

  async function fetchStats() {
    try {
      const [dailyTasks, habits, habitLogs, futureTasks] = await Promise.all([
        databases.listDocuments(DATABASE_ID, DAILY_TASKS_COLLECTION_ID, [Query.equal('userId', user.$id)]),
        databases.listDocuments(DATABASE_ID, HABITS_COLLECTION_ID, [Query.equal('userId', user.$id)]),
        databases.listDocuments(DATABASE_ID, HABIT_LOGS_COLLECTION_ID, [Query.equal('userId', user.$id)]),
        databases.listDocuments(DATABASE_ID, FUTURE_TASKS_COLLECTION_ID, [Query.equal('userId', user.$id)])
      ]);

      // Calculate habit stats
      let completedHabitsCount = 0;
      let continuingHabitsCount = 0;
      const now = new Date();

      habits.documents.forEach(habit => {
        if (habit.endDate) {
          const endDate = new Date(habit.endDate);
          if (now > endDate) {
            // Habit has ended, check if it was completed every day
            const startDate = new Date(habit.createdAt);
            const daysBetween = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

            // Get all habit logs for this habit
            const habitLogsForHabit = habitLogs.documents.filter(log => log.habitId === habit.$id);
            const uniqueDates = new Set(habitLogsForHabit.map(log => log.date?.split('T')[0]));

            // Check if all days have logs
            if (uniqueDates.size >= daysBetween) {
              completedHabitsCount++;
            }
          } else {
            // Habit is still continuing
            continuingHabitsCount++;
          }
        } else {
          // Habit has no end date, so it's continuing
          continuingHabitsCount++;
        }
      });

      // Calculate future tasks stats
      const completedFutureTasks = futureTasks.documents.filter(t => t.completed).length;
      const continuingFutureTasks = futureTasks.documents.filter(t => !t.completed).length;

      // Calculate streak (consecutive days with completed daily tasks)
      let streak = 0;
      const today = new Date();
      const taskDates = dailyTasks.documents
        .filter(t => t.completed)
        .map(t => t.date || t.createdAt?.split('T')[0])
        .sort((a, b) => new Date(b) - new Date(a));

      if (taskDates.length > 0) {
        const uniqueDates = [...new Set(taskDates)];
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (const dateStr of uniqueDates) {
          const checkDate = new Date(dateStr);
          checkDate.setHours(0, 0, 0, 0);

          const diffTime = Math.abs(currentDate - checkDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === streak) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      setStats({
        dailyTasksCompleted: dailyTasks.documents.filter(t => t.completed).length,
        dailyTasksTotal: dailyTasks.documents.length,
        streak: streak,
        habitsTotal: habits.documents.length,
        habitsCompleted: completedHabitsCount,
        habitsContinuing: continuingHabitsCount,
        futureTasksTotal: futureTasks.documents.length,
        futureTasksCompleted: completedFutureTasks,
        futureTasksContinuing: continuingFutureTasks
      });

      // Organize history by date
      const historyMap = {};
      
      // Add daily tasks to history
      dailyTasks.documents.forEach(task => {
        const date = task.date || task.createdAt?.split('T')[0];
        if (!historyMap[date]) {
          historyMap[date] = { dailyTasks: [], habits: [] };
        }
        historyMap[date].dailyTasks.push({
          title: task.title,
          completed: task.completed,
          completedAt: task.completed ? task.createdAt : null,
          type: 'daily_task'
        });
      });

      // Add habit logs to history
      habitLogs.documents.forEach(log => {
        const date = log.date || log.completedAt?.split('T')[0];
        if (!historyMap[date]) {
          historyMap[date] = { dailyTasks: [], habits: [] };
        }
        const habitName = habits.documents.find(h => h.$id === log.habitId)?.name || 'Unknown Habit';
        historyMap[date].habits.push({
          habitId: log.habitId,
          name: habitName,
          completedAt: log.completedAt,
          type: 'habit_completion'
        });
      });

      // Convert to array and sort by date (newest first)
      const sortedHistory = Object.entries(historyMap)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .map(([date, data]) => ({ date, ...data }));

      setHistory(sortedHistory);

      // Create separate history for future tasks
      const futureTasksMap = {};
      futureTasks.documents.forEach(task => {
        const date = task.deadline || task.createdAt?.split('T')[0];
        if (!futureTasksMap[date]) {
          futureTasksMap[date] = [];
        }
        futureTasksMap[date].push({
          title: task.title,
          completed: task.completed,
          deadline: task.deadline,
          completedAt: task.completed ? task.createdAt : null,
          type: 'future_task'
        });
      });

      const sortedFutureHistory = Object.entries(futureTasksMap)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .map(([date, tasks]) => ({ date, tasks }));

      setFutureTasksHistory(sortedFutureHistory);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      setDeleting(true);

      // Delete all user data from collections
      const [dailyTasks, habits, habitLogs, futureTasks] = await Promise.all([
        databases.listDocuments(DATABASE_ID, DAILY_TASKS_COLLECTION_ID, [Query.equal('userId', user.$id)]),
        databases.listDocuments(DATABASE_ID, HABITS_COLLECTION_ID, [Query.equal('userId', user.$id)]),
        databases.listDocuments(DATABASE_ID, HABIT_LOGS_COLLECTION_ID, [Query.equal('userId', user.$id)]),
        databases.listDocuments(DATABASE_ID, FUTURE_TASKS_COLLECTION_ID, [Query.equal('userId', user.$id)])
      ]);

      // Delete all documents
      const deletePromises = [
        ...dailyTasks.documents.map(doc => databases.deleteDocument(DATABASE_ID, DAILY_TASKS_COLLECTION_ID, doc.$id)),
        ...habits.documents.map(doc => databases.deleteDocument(DATABASE_ID, HABITS_COLLECTION_ID, doc.$id)),
        ...habitLogs.documents.map(doc => databases.deleteDocument(DATABASE_ID, HABIT_LOGS_COLLECTION_ID, doc.$id)),
        ...futureTasks.documents.map(doc => databases.deleteDocument(DATABASE_ID, FUTURE_TASKS_COLLECTION_ID, doc.$id))
      ];

      await Promise.all(deletePromises);

      // Delete the account
      const result = await deleteAccount();

      if (result.success) {
        navigate('/auth');
      } else {
        alert('Failed to delete account: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account: ' + error.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleImageUpload(file) {
    try {
      setUploading(true);

      // Upload image to Appwrite Storage
      const fileResponse = await storage.createFile(
        STORAGE_BUCKET_ID,
        ID.unique(),
        file
      );

      // Construct the direct file URL
      const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
      const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
      const fileUrl = `${endpoint}/storage/buckets/${STORAGE_BUCKET_ID}/files/${fileResponse.$id}/view?project=${projectId}`;

      // Update user preferences with image URL
      await account.updatePrefs({
        profileImage: fileUrl,
        profileImageId: fileResponse.$id
      });

      setProfileImage(fileUrl);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveProfileImage() {
    try {
      const userData = await account.get();
      if (userData.prefs?.profileImageId) {
        // Delete file from storage
        await storage.deleteFile(STORAGE_BUCKET_ID, userData.prefs.profileImageId);
      }

      // Update user preferences to remove image
      await account.updatePrefs({
        profileImage: null,
        profileImageId: null
      });

      setProfileImage(null);
    } catch (error) {
      console.error('Error removing profile image:', error);
      alert('Failed to remove profile image: ' + error.message);
    }
  }

  const statCards = [
    {
      icon: CheckSquare,
      label: 'Daily Tasks',
      value: `${stats.dailyTasksCompleted}/${stats.dailyTasksTotal}`,
      color: 'from-blue-500 to-cyan-500',
      description: 'Completed'
    },
    {
      icon: Flame,
      label: 'Streak',
      value: stats.streak,
      color: 'from-orange-500 to-red-500',
      description: 'Days active'
    },
    {
      icon: Award,
      label: 'Habits',
      value: `${stats.habitsContinuing} ongoing`,
      color: 'from-purple-500 to-pink-500 ',
      description: `${stats.habitsCompleted} completed`
    },
    {
      icon: Calendar,
      label: 'Future Tasks',
      value: `${stats.futureTasksContinuing} ongoing`,
      color: 'from-green-500 to-emerald-500',
      description: `${stats.futureTasksCompleted} completed`
    }
  ];

  return (
    <div className="mobile-container px-4 py-8 pb-20">
      <div className="mb-3 mt-[-12px]">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Profile</h1>
        <p className="text-gray-600 text-sm dark:text-gray-300">Your progress overview</p>
      </div>

      <div className="glass-card rounded-2xl p-2 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center overflow-hidden">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Image failed to load:', profileImage);
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-6 h-6 text-white" />
              )}
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="absolute -bottom-1 -right-1 p-1 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
              title="Change profile picture"
            >
              <Camera className="w-3 h-3 text-white" />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">{user?.name || 'User'}</h2>
            <p className="text-gray-600 text-xs dark:text-gray-300 truncate">{user?.email || ''}</p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-200 dark:border-gray-700 pt-1">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-200 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title="Delete Account - Permanently delete your account and all data"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Delete Account</span>
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/auth');
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Logout - Sign out of your account"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading stats...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {statCards.map((card) => (
              <div key={card.label} className="glass-card rounded-xl p-3 flex flex-col items-center">
                <div className={`p-2 bg-gradient-to-br ${card.color} rounded-lg w-fit mb-3`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>

                <p className="inline-block px-3 py-1 text-sm font-medium text-blue-700 bg-white/50 backdrop-blur-2xl border border-gray-200/50 rounded-xl shadow-lg ring-1 ring-white/60">
                  {card.label}
                </p>

                <p className="text-md font-bold text-gray-800 dark:text-gray-100">{card.value}</p>
                


                <p className="text-md font-bold text-green-800">
                  {card.description}
                </p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Achievements</h2>
              </div>
              <button
                onClick={() => setShowAchievementsInfo(true)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              {stats.habitsCompleted >= 10 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <Award className="w-5 h-5 text-yellow-600" />
                  <span className="text-gray-700 dark:text-gray-200">Habit Starter (10+ completions)</span>
                </div>
              )}
              {stats.habitsCompleted >= 50 && (
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <Target className="w-5 h-5 text-orange-600" />
                  <span className="text-gray-700 dark:text-gray-200">Habit Master (50+ completions)</span>
                </div>
              )}
              {stats.habitsCompleted >= 100 && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <Trophy className="w-5 h-5 text-purple-600" />
                  <span className="text-gray-700 dark:text-gray-200">Habit Legend (100+ completions)</span>
                </div>
              )}
              {stats.habitsTotal >= 3 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Flame className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-700 dark:text-gray-200">Multi-Habit User (3+ habits)</span>
                </div>
              )}
              {stats.habitsTotal >= 5 && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Sparkles className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700 dark:text-gray-200">Habit Enthusiast (5+ habits)</span>
                </div>
              )}
              {stats.dailyTasksCompleted >= 10 && (
                <div className="flex items-center gap-3 p-3 bg-cyan-50 rounded-lg">
                  <CheckSquare className="w-5 h-5 text-cyan-600" />
                  <span className="text-gray-700 dark:text-gray-200">Task Champion (10+ daily tasks)</span>
                </div>
              )}
              {stats.futureTasksCompleted >= 5 && (
                <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-lg">
                  <Clock className="w-5 h-5 text-pink-600" />
                  <span className="text-gray-700 dark:text-gray-200">Future Planner (5+ future tasks)</span>
                </div>
              )}
              {stats.habitsCompleted === 0 && stats.habitsTotal === 0 && stats.dailyTasksCompleted === 0 && stats.futureTasksCompleted === 0 && (
                <p className="text-gray-600 text-center py-4 dark:text-gray-300">Complete tasks and habits to unlock achievements!</p>
              )}
            </div>
          </div>

              <div className="glass-card rounded-2xl p-5">
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => setShowFutureHistory(!showFutureHistory)}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Future Tasks History</h2>
              </div>
              {showFutureHistory ? <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
            </div>

            {showFutureHistory && (
              <div className="space-y-4">
                {futureTasksHistory.length === 0 ? (
                  <p className="text-gray-600 text-center py-4 dark:text-gray-300">No future tasks history yet.</p>
                ) : (
                  futureTasksHistory.map((day) => (
                    <div key={day.date} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{formatDate(day.date)}</h3>
                      </div>

                      <div className="space-y-2">
                        {day.tasks.map((task, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Clock className={`w-4 h-4 ${task.completed ? 'text-green-500' : 'text-purple-500'}`} />
                            <span className={task.completed ? 'text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}>
                              {task.title}
                            </span>
                            {task.completed && task.completedAt && (
                              <span className="text-xs text-gray-500 ml-auto">
                                {new Date(task.completedAt).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: true})}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-5 mt-4">
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => setShowHistory(!showHistory)}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Detailed History</h2>
              </div>
              {showHistory ? <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
            </div>
            
            {showHistory && (
              <div className="space-y-4">
                {history.length === 0 ? (
                  <p className="text-gray-600 text-center py-4 dark:text-gray-300">No history yet. Start completing tasks!</p>
                ) : (
                  history.map((day) => (
                    <div key={day.date} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{formatDate(day.date)}</h3>
                      </div>
                      
                      {day.dailyTasks.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-blue-600 mb-2">Daily Tasks</p>
                          <div className="space-y-2">
                            {day.dailyTasks.map((task, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <CheckSquare className={`w-4 h-4 ${task.completed ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`} />
                                <span className={task.completed ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 line-through'}>
                                  {task.title}
                                </span>
                                {task.completedAt && (
                                  <span className="text-xs text-gray-500 ml-auto dark:text-gray-400">
                                    {new Date(task.completedAt).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: true})}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {day.habits.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-orange-600 mb-2">Habits Completed</p>
                          <div className="space-y-2">
                            {day.habits.map((habit, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <Flame className="w-4 h-4 text-orange-500" />
                                <span className="text-gray-800 dark:text-gray-100">{habit.name}</span>
                                {habit.completedAt && (
                                  <span className="text-xs text-gray-500 ml-auto dark:text-gray-400">
                                    {new Date(habit.completedAt).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: true})}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {day.dailyTasks.length === 0 && day.habits.length === 0 && (
                        <p className="text-gray-500 text-sm dark:text-gray-400">No activity on this day</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          

          {showAchievementsInfo && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-[#232946] rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Achievement Details</h3>
                  <button
                    onClick={() => setShowAchievementsInfo(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Multi-Habit User</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Have 3+ active habits to unlock this achievement.</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Habit Enthusiast</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Have 5+ active habits to unlock this achievement.</p>
                  </div>
                  <div className="p-3 bg-pink-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-pink-600" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Future Planner</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Complete 5+ future tasks to unlock this achievement.</p>
                  </div>
                  <div className="p-3 bg-cyan-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckSquare className="w-4 h-4 text-cyan-600" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Task Champion</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Complete 10+ daily tasks to unlock this achievement.</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-yellow-600" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Habit Starter</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Complete 10+ habit completions to unlock this achievement.</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-orange-600" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Habit Master</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Complete 50+ habit completions to unlock this achievement.</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100">Habit Legend</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Complete 100+ habit completions to unlock this achievement.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-[#232946] rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Profile Picture</h3>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center overflow-hidden">
                      {profileImage ? (
                        <img src={profileImage} alt="Profile Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                      disabled={uploading}
                      className="hidden"
                      id="profile-image-input"
                    />
                    <label
                      htmlFor="profile-image-input"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          Upload New Picture
                        </>
                      )}
                    </label>
                    {profileImage && (
                      <button
                        onClick={handleRemoveProfileImage}
                        disabled={uploading}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-5 h-5" />
                        Remove Picture
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Recommended: Square image, max 5MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-[#232946] rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Delete Account</h3>
                </div>
                <div className="space-y-4 mb-6">
                  <p className="text-gray-600 dark:text-gray-300">
                    Are you sure you want to delete your account? This action cannot be undone.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This will permanently delete:
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
                    <li>Your account and authentication data</li>
                    <li>All your daily tasks</li>
                    <li>All your habits</li>
                    <li>All your habit logs</li>
                    <li>All your future tasks</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
