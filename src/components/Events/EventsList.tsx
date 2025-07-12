import React, { useState, useMemo } from 'react';
import { Plus, Calendar, Clock, MapPin, ChefHat, Search, X, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AssignmentModal } from './AssignmentModal';
import { EditAssignmentModal } from './EditAssignmentModal';
import { MenuItemCard } from './MenuItemCard';
import { MenuItem, Assignment } from '../../types';
import { formatDate, formatTime, isEventPast } from '../../utils/dateUtils';
import { BulkItemsManager } from '../Admin/BulkItemsManager';
import { UserMenuItemForm } from './UserMenuItemForm';
import { CategorySelector } from './CategorySelector';

const categoryNames: { [key: string]: string } = {
  starter: 'מנות ראשונות',
  main: 'מנות עיקריות',
  dessert: 'קינוחים',
  drink: 'משקאות',
  other: 'אחר',
};

export function EventsList() {
  const { events, menuItems, assignments, isLoading, user, users } = useStore();
  const isAdmin = user?.isAdmin || false;

  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<{ item: MenuItem; assignment: Assignment } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [showUserItemForm, setShowUserItemForm] = useState(false);

  // New state to manage the view
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showMyAssignments, setShowMyAssignments] = useState(false);

  const activeEvent = useMemo(() => {
    const activeEvents = events.filter(event => {
      const isPastEvent = isEventPast(event.date, event.time);
      return event.isActive && !isPastEvent;
    });
    return activeEvents.length > 0 ? activeEvents[0] : null;
  }, [events]);

  const eventMenuItems = useMemo(() => {
    if (!activeEvent) return [];
    
    return menuItems.filter(item => {
      if (item.eventId !== activeEvent.id) return false;
      
      if (!isAdmin && item.category === 'other' && 
          (item.name.includes('שולחן') || item.name.includes('כיסא') || 
           item.name.includes('צלחת') || item.name.includes('כוס') || 
           item.name.includes('סכו"ם') || item.name.includes('מגש') ||
           item.name.includes('מפית') || item.name.includes('מפה'))) {
        return false;
      }
      
      return true;
    });
  }, [menuItems, activeEvent, isAdmin]);

  const userCreatedItemsCount = useMemo(() => {
    if (!user || !activeEvent) return 0;
    return eventMenuItems.filter(item => item.creatorId === user.id).length;
  }, [eventMenuItems, user, activeEvent]);

  const MAX_USER_ITEMS = 3;
  const canAddMoreItems = userCreatedItemsCount < MAX_USER_ITEMS;

  const eventAssignments = useMemo(() => 
    activeEvent ? assignments.filter(assignment => assignment.eventId === activeEvent.id) : [],
    [assignments, activeEvent]
  );

  const assignedItems = useMemo(() =>
    eventMenuItems.filter(item => {
      return eventAssignments.some(a => a.menuItemId === item.id);
    }),
    [eventMenuItems, eventAssignments]
  );

  const displayedItems = useMemo(() => {
    let items = eventMenuItems;

    if (searchTerm.trim()) {
      return items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      );
    }

    if (showMyAssignments) {
      return items.filter(item =>
        eventAssignments.some(a => a.menuItemId === item.id && a.userId === user?.id)
      );
    }

    if (selectedCategory) {
      return items.filter(item => item.category === selectedCategory);
    }

    return [];
  }, [eventMenuItems, searchTerm, selectedCategory, showMyAssignments, eventAssignments, user?.id]);

  const itemsToRender = useMemo(() => {
    if (searchTerm.trim() || showMyAssignments || selectedCategory) {
      const assigned = displayedItems.filter(item =>
        eventAssignments.some(a => a.menuItemId === item.id)
      );
      const available = displayedItems.filter(item =>
        !eventAssignments.some(a => a.menuItemId === item.id)
      );
      return { assigned, available };
    }
    return { assigned: [], available: [] };
  }, [displayedItems, eventAssignments, searchTerm, showMyAssignments, selectedCategory]);

  const canAssign = activeEvent && !isEventPast(activeEvent.date, activeEvent.time) && activeEvent.isActive;

  const handleAssignItem = (item: MenuItem) => {
    if (!canAssign) return;
    setSelectedMenuItem(item);
  };

  const handleEditAssignment = async (item: MenuItem) => {
    if (!user || !canAssign) return;
    const assignment = eventAssignments.find(a => a.menuItemId === item.id && a.userId === user.id);
    if (assignment) {
      setEditingAssignment({ item, assignment });
    }
  };
  
  if (showBulkManager) {
    return <BulkItemsManager onBack={() => setShowBulkManager(false)} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-500 mt-4">טוען אירוע...</p>
        </div>
      )}

      {!isLoading && !activeEvent && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4"><Calendar className="h-8 w-8 text-gray-400" /></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין אירוע פעיל כרגע</h3>
          <p className="text-gray-500 mb-4">{isAdmin ? 'עבור למסך הניהול כדי ליצור או להפעיל אירוע' : 'אירוע חדש יפורסם בקרוב'}</p>
        </div>
      )}

      {!isLoading && activeEvent && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-text truncate">{activeEvent.title}</h1>
                {isAdmin && (<button onClick={() => setShowBulkManager(true)} className="text-xs bg-primary hover:bg-primary-dark text-white font-semibold px-3 py-1.5 rounded-md transition-colors">BULK EDIT</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-text">
                <div className="flex items-center"><Calendar className="h-3 w-3 ml-1" /><span>{formatDate(activeEvent.date)}</span></div>
                <div className="flex items-center"><Clock className="h-3 w-3 ml-1" /><span>{formatTime(activeEvent.time)}</span></div>
                <div className="flex items-center"><MapPin className="h-3 w-3 ml-1" /><span className="truncate max-w-24">{activeEvent.location}</span></div>
                {eventMenuItems.length > 0 && (<div className="flex items-center"><ChefHat className="h-3 w-3 ml-1" /><span className="font-medium text-success">{assignedItems.length}/{eventMenuItems.length} שובצו</span></div>)}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              <div className="flex-grow">
                <label className="block text-xs font-medium text-text mb-1">חיפוש מהיר</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="חפש פריט..."
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="נקה חיפוש"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-text mb-1 invisible">השיבוצים שלי</label>
                <button
                  onClick={() => {
                    setShowMyAssignments(true);
                    setSelectedCategory(null);
                  }}
                  className="w-full px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark transition-colors text-sm"
                >
                  השיבוצים שלי
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            {searchTerm.trim() === '' && !selectedCategory && !showMyAssignments ? (
              <CategorySelector
                menuItems={eventMenuItems}
                assignments={eventAssignments}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                }}
                onAddItem={() => setShowUserItemForm(true)}
                canAddMoreItems={canAddMoreItems}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setShowMyAssignments(false);
                      setSearchTerm('');
                    }}
                    className="flex items-center text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
                  >
                    <ArrowRight className="h-4 w-4 ml-2" />
                    {showMyAssignments ? 'חזור לקטגוריות' : selectedCategory ? 'חזור לקטגוריות' : 'חזרה'}
                  </button>
                  <h2 className="text-lg font-bold text-text">
                    {showMyAssignments ? 'השיבוצים שלי' : selectedCategory ? categoryNames[selectedCategory] : 'תוצאות חיפוש'}
                  </h2>
                </div>

                {itemsToRender.available.length === 0 && itemsToRender.assigned.length === 0 ? (
                  <div className="text-center py-8">
                    <ChefHat className="h-12 w-12 mx-auto text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-text">
                      {showMyAssignments ? 'עדיין לא שובצת לפריטים' : 'אין פריטים בקטגוריה זו'}
                    </h3>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {itemsToRender.available.length > 0 && (
                      <div>
                        <h3 className="text-md font-semibold text-text mb-3">פריטים פנויים</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {itemsToRender.available.map((item) => (
                            <MenuItemCard key={item.id} item={item} canAssign={!!canAssign} onAssign={() => handleAssignItem(item)} onEdit={() => handleEditAssignment(item)} onAssignmentCancelled={() => { setSelectedCategory(null); setShowMyAssignments(false); }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {itemsToRender.assigned.length > 0 && (
                      <div>
                        <h3 className="text-md font-semibold text-text mb-3 border-t pt-4 mt-4">פריטים ששובצו</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {itemsToRender.assigned.map((item) => (
                            <MenuItemCard key={item.id} item={item} canAssign={!!canAssign} onAssign={() => handleAssignItem(item)} onEdit={() => handleEditAssignment(item)} assignedTo={eventAssignments.find(a => a.menuItemId === item.id)?.userId} allUsers={users} onAssignmentCancelled={() => { setSelectedCategory(null); setShowMyAssignments(false); }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {selectedMenuItem && activeEvent && (<AssignmentModal menuItem={selectedMenuItem} event={activeEvent} onClose={() => setSelectedMenuItem(null)} />)}
      {editingAssignment && activeEvent && (<EditAssignmentModal menuItem={editingAssignment.item} event={activeEvent} assignment={editingAssignment.assignment} onClose={() => setEditingAssignment(null)} />)}
      
      {showUserItemForm && activeEvent && (<UserMenuItemForm event={activeEvent} onClose={() => setShowUserItemForm(false)} />)}
    </div>
  );
}
