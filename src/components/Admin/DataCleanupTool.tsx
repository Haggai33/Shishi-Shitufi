import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, X, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ref, update, get } from 'firebase/database';
import { database } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface DataCleanupToolProps {
  onClose: () => void;
}

interface InconsistentData {
  menuItemId: string;
  menuItemName: string;
  assignedTo: string;
  assignedToName: string;
  hasAssignmentRecord: boolean;
  eventTitle: string;
}

export function DataCleanupTool({ onClose }: DataCleanupToolProps) {
  const { menuItems, assignments, events, updateMenuItem, deleteAssignment } = useStore();
  const [isScanning, setIsScanning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [inconsistentData, setInconsistentData] = useState<InconsistentData[]>([]);
  const [scanCompleted, setScanCompleted] = useState(false);

  const scanForInconsistencies = async () => {
    setIsScanning(true);
    const issues: InconsistentData[] = [];

    try {
      // בדיקת פריטים עם שיבוץ שלא קיים ברשימת השיבוצים
      for (const item of menuItems) {
        if (item.assignedTo && item.assignedToName) {
          // בדוק אם יש רשומת שיבוץ תואמת
          const hasAssignmentRecord = assignments.some(
            a => a.menuItemId === item.id && a.userId === item.assignedTo
          );

          if (!hasAssignmentRecord) {
            const event = events.find(e => e.id === item.eventId);
            issues.push({
              menuItemId: item.id,
              menuItemName: item.name,
              assignedTo: item.assignedTo,
              assignedToName: item.assignedToName,
              hasAssignmentRecord: false,
              eventTitle: event?.title || 'אירוע לא ידוע'
            });
          }
        }
      }

      // בדיקת שיבוצים שהפריט שלהם לא מסומן כמשובץ
      for (const assignment of assignments) {
        const menuItem = menuItems.find(item => item.id === assignment.menuItemId);
        if (menuItem && menuItem.assignedTo !== assignment.userId) {
          const event = events.find(e => e.id === assignment.eventId);
          issues.push({
            menuItemId: menuItem.id,
            menuItemName: menuItem.name,
            assignedTo: assignment.userId,
            assignedToName: assignment.userName,
            hasAssignmentRecord: true,
            eventTitle: event?.title || 'אירוע לא ידוע'
          });
        }
      }

      setInconsistentData(issues);
      setScanCompleted(true);
      
      if (issues.length === 0) {
        toast.success('לא נמצאו בעיות עקביות בנתונים!');
      } else {
        toast.warning(`נמצאו ${issues.length} בעיות עקביות`);
      }
    } catch (error) {
      console.error('Error scanning for inconsistencies:', error);
      toast.error('שגיאה בסריקת הנתונים');
    } finally {
      setIsScanning(false);
    }
  };

  const fixAllInconsistencies = async () => {
    if (inconsistentData.length === 0) return;

    if (!confirm(`האם אתה בטוח שברצונך לתקן ${inconsistentData.length} בעיות עקביות? פעולה זו תנקה שיבוצים רפאים.`)) {
      return;
    }

    setIsFixing(true);
    let fixedCount = 0;
    let errorCount = 0;

    try {
      const updates: { [key: string]: any } = {};

      for (const issue of inconsistentData) {
        try {
          if (!issue.hasAssignmentRecord) {
            // פריט משובץ ללא רשומת שיבוץ - נקה את השיבוץ מהפריט
            updates[`/menuItems/${issue.menuItemId}/assignedTo`] = null;
            updates[`/menuItems/${issue.menuItemId}/assignedToName`] = null;
            updates[`/menuItems/${issue.menuItemId}/assignedAt`] = null;
            
            // עדכן גם ב-store המקומי
            updateMenuItem(issue.menuItemId, {
              assignedTo: undefined,
              assignedToName: undefined,
              assignedAt: undefined
            });
            
            fixedCount++;
          } else {
            // יש רשומת שיבוץ אבל הפריט לא מסומן - עדכן את הפריט
            const assignment = assignments.find(a => 
              a.menuItemId === issue.menuItemId && a.userId === issue.assignedTo
            );
            
            if (assignment) {
              updates[`/menuItems/${issue.menuItemId}/assignedTo`] = assignment.userId;
              updates[`/menuItems/${issue.menuItemId}/assignedToName`] = assignment.userName;
              updates[`/menuItems/${issue.menuItemId}/assignedAt`] = assignment.assignedAt;
              
              // עדכן גם ב-store המקומי
              updateMenuItem(issue.menuItemId, {
                assignedTo: assignment.userId,
                assignedToName: assignment.userName,
                assignedAt: assignment.assignedAt
              });
              
              fixedCount++;
            }
          }
        } catch (error) {
          console.error(`Error fixing issue for item ${issue.menuItemId}:`, error);
          errorCount++;
        }
      }

      // בצע את כל העדכונים בפעולה אטומית אחת
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }

      if (fixedCount > 0) {
        toast.success(`תוקנו ${fixedCount} בעיות עקביות!`);
        // סרוק שוב כדי לוודא שהתיקון עבד
        await scanForInconsistencies();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} בעיות נכשלו בתיקון`);
      }

    } catch (error) {
      console.error('Error fixing inconsistencies:', error);
      toast.error('שגיאה בתיקון הנתונים');
    } finally {
      setIsFixing(false);
    }
  };

  const fixSingleIssue = async (issue: InconsistentData) => {
    try {
      if (!issue.hasAssignmentRecord) {
        // נקה את השיבוץ מהפריט
        const updates = {
          assignedTo: undefined,
          assignedToName: undefined,
          assignedAt: undefined
        };
        
        await FirebaseService.updateMenuItem(issue.menuItemId, updates, true);
        updateMenuItem(issue.menuItemId, updates);
        
        toast.success('השיבוץ הרפאים נוקה!');
      }
      
      // הסר מהרשימה
      setInconsistentData(prev => prev.filter(item => item.menuItemId !== issue.menuItemId));
      
    } catch (error) {
      console.error('Error fixing single issue:', error);
      toast.error('שגיאה בתיקון הבעיה');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="bg-orange-100 rounded-lg p-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">כלי ניקוי נתונים</h2>
              <p className="text-sm text-gray-600">זיהוי ותיקון בעיות עקביות בנתונים</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isScanning || isFixing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!scanCompleted ? (
            <div className="text-center py-8">
              <div className="bg-blue-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">סריקת עקביות נתונים</h3>
              <p className="text-gray-500 mb-6">
                הכלי יסרוק את מסד הנתונים לאיתור בעיות עקביות כמו "שיבוצים רפאים"
              </p>
              <button
                onClick={scanForInconsistencies}
                disabled={isScanning}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 rtl:space-x-reverse mx-auto"
              >
                {isScanning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>סורק...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>התחל סריקה</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              {inconsistentData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">הנתונים עקביים!</h3>
                  <p className="text-gray-500">לא נמצאו בעיות עקביות במסד הנתונים</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        נמצאו {inconsistentData.length} בעיות עקביות
                      </h3>
                      <p className="text-sm text-gray-600">
                        פריטים עם שיבוצים רפאים או חוסר התאמה בין הנתונים
                      </p>
                    </div>
                    <div className="flex space-x-3 rtl:space-x-reverse">
                      <button
                        onClick={scanForInconsistencies}
                        disabled={isScanning || isFixing}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        סרוק שוב
                      </button>
                      <button
                        onClick={fixAllInconsistencies}
                        disabled={isFixing}
                        className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        {isFixing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>מתקן...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            <span>תקן הכל</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {inconsistentData.map((issue, index) => (
                      <div key={`${issue.menuItemId}-${index}`} className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{issue.menuItemName}</h4>
                            <p className="text-sm text-gray-600">אירוע: {issue.eventTitle}</p>
                            <p className="text-sm text-red-600">
                              {issue.hasAssignmentRecord 
                                ? `יש רשומת שיבוץ ל-${issue.assignedToName} אבל הפריט לא מסומן כמשובץ`
                                : `הפריט מסומן כמשובץ ל-${issue.assignedToName} אבל אין רשומת שיבוץ`
                              }
                            </p>
                          </div>
                          <button
                            onClick={() => fixSingleIssue(issue)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            תקן
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}