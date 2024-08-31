import { GDrive, GFileBrowser } from '../GDrive';
import { appendFile, formatPath, readFile } from '../zenfsUtils';
import { FS_Drive } from '../fs_drive';
import { toISOLocal } from '../csv';

import './index.css';

const clientId = "849761124848-uolvtqiurtjcnql91i224olp2diipeca.apps.googleusercontent.com";
const apiKey = "AIzaSyBYZX_H637kXgVvtNmhuy2D92KnFTPCC4c";

const gdrive = new GFileBrowser(apiKey, clientId, "AppData");
const fsDrive = new FS_Drive(gdrive);

// HTML elements
// const form = document.getElementById('apiForm');
const authButton = document.getElementById('auth-button');
const addNoteButton = document.getElementById('add-note-button');
const backupButton = document.getElementById('backup-button');
const restoreButton = document.getElementById('restore-button');
const noteInput = document.getElementById('note-input');
const notesTableBody = document.getElementById('notes-table').querySelector('tbody');
const filenameInput = document.getElementById('filename-input');

const prevWeekButton = document.getElementById('prev-week');
const nextWeekButton = document.getElementById('next-week');
const currentWeekSpan = document.getElementById('current-week');
const calendarTableBody = document.getElementById('calendar-table').querySelector('tbody');

const calendarSelect = document.getElementById('calendar-select');
const newCalendarNameInput = document.getElementById('new-calendar-name');
const createCalendarButton = document.getElementById('create-calendar-button');
const deleteCalendarButton = document.getElementById('delete-calendar-button');

const openAddEventModalButton = document.getElementById('open-add-event-modal');
const addEventModal = document.getElementById('add-event-modal');
const closeAddEventModalButton = addEventModal.querySelector('.close');

const addEventForm = document.getElementById("add-event-form");
const eventDetailsContent = document.getElementById('event-details-content');
const eventSummaryInput = document.getElementById('event-summary');
const eventLocationInput = document.getElementById('event-location');
const eventDescriptionInput = document.getElementById('event-description');
const eventColorIdInput = document.getElementById('event-colorId');
const eventStartInput = document.getElementById('event-start');
const eventEndInput = document.getElementById('event-end');
const eventAttendeesInput = document.getElementById('event-attendees');
const eventEmailMessageInput = document.getElementById('event-email-message');
const sendNotificationsCheckbox = document.getElementById('send-notifications');
const eventRecurrenceInput = document.getElementById('event-recurrence');
const eventStatusInput = document.getElementById('event-status');
const eventVisibilityInput = document.getElementById('event-visibility');
const guestsCanSeeCheckbox = document.getElementById('guests-can-see');
const guestsCanModifyCheckbox = document.getElementById('guests-can-modify');
const guestsCanInviteCheckbox = document.getElementById('guests-can-invite');
const eventSourceTitleInput = document.getElementById('event-source-title');
const eventSourceUrlInput = document.getElementById('event-source-url');
const createEventButton = document.getElementById('create-event-button');
const deleteEventButton = document.getElementById('delete-event-button');
const addReminderButton = document.getElementById('add-reminder-button');
const addAttachmentButton = document.getElementById('add-attachment-button');
const attachmentsSection = document.getElementById('attachments-section');
const tasksList = document.getElementById('tasks-list');
const addTaskButton = document.getElementById('add-task-button');
const tasksCalendarSelect = document.getElementById('tasks-calendar-select');

let currentWeekStart = new Date();
currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1); // Set to Monday of the current week



const onAuthClick = async () => {
    if (!gdrive.isLoggedIn) {
        try {
            await gdrive.handleUserSignIn();
            authButton.disabled = true;
        } catch (error) {
            console.error('Error signing in:', error);
        }
    }
    if (gdrive.isLoggedIn) {
        await initializeTasksCalendar(); // Initialize the Tasks calendar
        await loadCalendars(); // Load calendars after signing in
        renderCalendar(); // Render the calendar after signing in
        gdrive.createFileBrowser('file-browser-container');
        gdrive.createFileUploader('file-browser-container');
    }
    authButton.innerText = 'Sign Out';
    authButton.onclick = async () => {
        await gdrive.signOut();
        authButton.onclick = onAuthClick;
    }
}


authButton.onclick = onAuthClick;



// --------------
/// NOTE TAKING TESTING, should make a couple views for notes and spreadsheets and drive backup
// --------------


// Function to add a note to the table
const addNote = (note) => {
    const timestamp = toISOLocal(Date.now());
    const row = document.createElement('tr');
    row.innerHTML = `<td>${timestamp}</td><td>${note}</td>`;
    notesTableBody.appendChild(row);
};

// Function to save table data to local file system
const saveNotesToLocalFS = async (filename) => {
    let data = [];
    notesTableBody.querySelectorAll('tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        data.push([cells[0].innerText, cells[1].innerText]);
    });
    const csvContent = data.map(e => e.join(",")).join("\n");
    const path = formatPath(`/${filename}.csv`, '/data');
    console.log(path, csvContent);
    await appendFile(path, csvContent);
    console.log(`Notes saved to ${path}`);
};

// Function to load table data from local file system
const loadNotesFromLocalFS = async (filename) => {
    const path = formatPath(`/${filename}.csv`, '/data');
    const data = await readFile(path);
    if (data) {
        notesTableBody.innerHTML = '';
        data.split('\n').forEach(line => {
            const [timestamp, note] = line.split(',');
            const row = document.createElement('tr');
            row.innerHTML = `<td>${timestamp}</td><td>${note}</td>`;
            notesTableBody.appendChild(row);
        });
    }
};


addNoteButton.addEventListener('click', () => {
    const note = noteInput.value.trim();
    if (note) {
        addNote(note);
        noteInput.value = '';
    }
});

backupButton.addEventListener('click', async () => {
    const filename = filenameInput.value.trim();
    if (filename) {
        await saveNotesToLocalFS(filename);
        await fsDrive.backupFS_CSVToDrive(`/data/${filename}.csv`);
        console.log(`Backup to Drive completed for ${filename}.csv`);
    }
});

restoreButton.addEventListener('click', async () => {
    const filename = filenameInput.value.trim();
    if (filename) {
        const file = await gdrive.getFileMetadataByName(filename);
        if (file) {
            await fsDrive.driveToLocalDB(file);
            await loadNotesFromLocalFS(filename);
            console.log(`Restore from Drive completed for ${filename}.csv`);
        }
    }
});




//-------------------------
// CALENDAR TESTING
//-------------------------

// Function to render the calendar
const renderCalendar = async () => {
    if(!gdrive.isLoggedIn) return;
    calendarTableBody.innerHTML = '';
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        weekDates.push(date);
    }
    currentWeekSpan.textContent = `${weekDates[0].toDateString()} - ${weekDates[6].toDateString()}`;

    for (let hour = 0; hour < 24; hour++) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${hour}:00</td>` + weekDates.map(date => `<td></td>`).join('');
        calendarTableBody.appendChild(row);
    }

    const selectedCalendarId = calendarSelect.value;

    // Load events for each day
    for (const date of weekDates) {
        const timeMin = new Date(date);
        timeMin.setHours(0, 0, 0, 0);
        const timeMax = new Date(date);
        timeMax.setHours(23, 59, 59, 999);
        const events = await gdrive.listEvents(selectedCalendarId, timeMin.toISOString(), timeMax.toISOString());
        for (const event of events) {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            const dayIndex = weekDates.findIndex(d => d.toDateString() === start.toDateString());
            const rowIndex = start.getHours();
            const cell = calendarTableBody.querySelector(`tr:nth-child(${rowIndex + 1}) td:nth-child(${dayIndex + 2})`);
            
            // Create a div for the event
            const eventDiv = document.createElement('div');
            eventDiv.textContent = event.summary;
            eventDiv.style.backgroundColor = event.colorId ? (colorTable[parseInt(event.colorId)]?.hex || colorTable[0].hex) : colorTable[0].hex; // Default color if colorId is not specified
            eventDiv.style.cursor = 'pointer';
            eventDiv.dataset.eventId = event.id;

            eventDiv.addEventListener('click', () => {
                showEventDetails(event);
            });

            cell.appendChild(eventDiv);
        }
    }
};
// Function to show event details in a modal
const showEventDetails = (event) => {
    const eventDetailsContent = document.getElementById('event-details-content');
    const deleteEventButton = document.getElementById('delete-event-button');
    
    eventDetailsContent.innerHTML = `
        <p><strong>Summary:</strong> ${event.summary}</p>
        <p><strong>Location:</strong> ${event.location || 'N/A'}</p>
        <p><strong>Description:</strong> ${event.description || 'N/A'}</p>
        <p><strong>Start:</strong> ${new Date(event.start.dateTime).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(event.end.dateTime).toLocaleString()}</p>
        <p><strong>Attendees:</strong> ${event.attendees ? event.attendees.map(att => att.email).join(', ') : 'N/A'}</p>
        <p><strong>Color ID:</strong> ${event.colorId || 'N/A'}</p>
    `;

    if (event.creator.self) {
        deleteEventButton.style.display = 'block';
        deleteEventButton.onclick = async () => {
            try {
                await gdrive.deleteEvent(event.calendarId, event.id);
                renderCalendar(); // Refresh the calendar view
                document.getElementById('event-details-modal').style.display = 'none';
            } catch (error) {
                console.error('Error deleting event:', error);
            }
        };
    } else {
        deleteEventButton.style.display = 'none';
    }

    document.getElementById('event-details-modal').style.display = 'block';
};

// Event listener to close the event details modal
document.querySelector('#event-details-modal .close').addEventListener('click', () => {
    document.getElementById('event-details-modal').style.display = 'none';
});

// Function to load all calendars into the dropdown
const loadCalendars = async () => {
    const calendars = await gdrive.listAllCalendars();
    calendarSelect.innerHTML = '';
    calendars.forEach(calendar => {
        const option = document.createElement('option');
        option.value = calendar.id;
        option.textContent = calendar.summary;
        calendarSelect.appendChild(option);
    });
};

// Function to upload an attachment file to Google Drive
const uploadAttachmentFile = async (file) => {
    const uploadProgress = document.createElement('progress');
    document.body.appendChild(uploadProgress);
    try {
        const response = await gdrive.uploadFileToGoogleDrive(file, file.name, file.type, gdrive.directoryId, (progressEvent) => {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            uploadProgress.value = progress;
        });
        document.body.removeChild(uploadProgress);
        return response;
    } catch (error) {
        console.error('Error uploading attachment:', error);
        document.body.removeChild(uploadProgress);
        throw error;
    }
};

// Function to share an attachment file with attendees
const shareAttachmentFile = async (fileId, attendees, sendNotifications, emailMessage) => {
    const shareOptions = {
        sendNotificationEmail: sendNotifications,
        emailMessage,
    };
    for (const attendee of attendees) {
        await gdrive.shareFile(fileId, attendee.email, 'reader', shareOptions);
    }
};

// Function to add a reminder input field
const addReminderField = () => {
    const remindersSection = document.getElementById('reminders-section');
    const reminderCount = remindersSection.querySelectorAll('.reminder').length;
    if (reminderCount < 5) {
        const reminderDiv = document.createElement('div');
        reminderDiv.classList.add('reminder');
        reminderDiv.innerHTML = `
            <select class="reminder-method">
                <option value="popup">Popup</option>
                <option value="email">Email</option>
            </select>
            <input type="number" class="reminder-time" placeholder="Minutes before event">
        `;
        remindersSection.insertBefore(reminderDiv, addReminderButton);
    }
};


// Event listeners for calendar management
createCalendarButton.addEventListener('click', async () => {
    const calendarName = newCalendarNameInput.value.trim();
    if (calendarName) {
        try {
            await gdrive.createCalendar(calendarName);
            await loadCalendars();
            newCalendarNameInput.value = ''; // Clear the input field after creation
            alert(`Calendar '${calendarName}' created successfully.`);
        } catch (error) {
            console.error('Error creating calendar:', error);
            alert('Failed to create calendar.');
        }
    } else {
        alert('Please enter a calendar name.');
    }
});

deleteCalendarButton.addEventListener('click', async () => {
    const selectedCalendarId = calendarSelect.value;
    if (selectedCalendarId) {
        try {
            await gdrive.deleteCalendar(selectedCalendarId);
            await loadCalendars();
            alert('Calendar deleted successfully.');
        } catch (error) {
            console.error('Error deleting calendar:', error);
            alert('Failed to delete calendar.');
        }
    } else {
        alert('Please select a calendar to delete.');
    }
});

// Event listener for adding a reminder
addReminderButton.addEventListener('click', addReminderField);


openAddEventModalButton.addEventListener('click', () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 2 hours from now
    
    //reset inputs in the form
    addEventForm.reset();

    eventStartInput.value = startTime.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    eventEndInput.value = endTime.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"

    addEventModal.style.display = 'block';
});

// Event listener to close the add event modal
closeAddEventModalButton.addEventListener('click', () => {
    addEventModal.style.display = 'none';
});

// Event listeners for week navigation
prevWeekButton.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderCalendar();
});
nextWeekButton.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderCalendar();
});

// Function to add an attachment input field
const addAttachmentField = () => {
    const attachmentDiv = document.createElement('div');
    attachmentDiv.classList.add('attachment');
    attachmentDiv.innerHTML = `
        <input type="file" class="event-attachment">
        <input type="url" class="event-attachment-url" placeholder="Enter file URL">
    `;
    attachmentsSection.appendChild(attachmentDiv);
};

// Event listener for adding an attachment
addAttachmentButton.addEventListener('click', addAttachmentField);

//should use these to color code events listed too
const colorTable = [ //https://lukeboyle.com/blog/posts/google-calendar-api-color-id
    { id: '', name: 'Default', hex: '#039be5' },
    { id: '1', name: 'Lavender', hex: '#7986cb' },
    { id: '2', name: 'Sage', hex: '#33b679' },
    { id: '3', name: 'Purple', hex: '#8e24aa' },
    { id: '4', name: 'Pink', hex: '#e67c73' },
    { id: '5', name: 'Yellow', hex: '#f6c026' },
    { id: '6', name: 'Tangerine', hex: '#f5511d' },
    { id: '7', name: 'Light Blue', hex: '#039be5' },
    { id: '8', name: 'Graphite', hex: '#616161' },
    { id: '9', name: 'Blue', hex: '#3f51b5' },
    { id: '10', name: 'Green', hex: '#0b8043' },
    { id: '11', name: 'Red', hex: '#d60000' }
];

// Function to populate the color ID select dropdown
const populateColorSelect = () => {
    const colorSelect = document.getElementById('event-colorId');
    colorTable.forEach(color => {
        const option = document.createElement('option');
        option.value = color.id;
        option.textContent = color.name;
        option.style.backgroundColor = color.hex;
        colorSelect.appendChild(option);
    });
};

// Call the function to populate the color ID select dropdown
populateColorSelect();

addEventForm.addEventListener('submit',(ev) => {
    ev.preventDefault();
})

createEventButton.addEventListener('click', async () => {
    if(!addEventForm.checkValidity()) throw new Error("Check required fields");
    const summary = eventSummaryInput.value.trim();
    const location = eventLocationInput.value.trim();
    const description = eventDescriptionInput.value.trim();
    const colorId = eventColorIdInput.value?.trim();
    const start = eventStartInput.value;
    const end = eventEndInput.value;
    const attendees = eventAttendeesInput.value.trim();
    const emailMessage = eventEmailMessageInput.value.trim();
    const sendNotifications = sendNotificationsCheckbox.checked;
    const recurrenceFrequency = document.getElementById('event-recurrence-frequency').value;
    const recurrenceCount = document.getElementById('event-recurrence-count').value;
    const recurrenceEnd = document.getElementById('event-recurrence-end').value;
    const status = eventStatusInput.value;
    const visibility = eventVisibilityInput.value;
    const guestsCanSeeOtherGuests = guestsCanSeeCheckbox.checked;
    const guestsCanModify = guestsCanModifyCheckbox.checked;
    const guestsCanInviteOthers = guestsCanInviteCheckbox.checked;
    const srcTitle = eventSourceTitleInput.value.trim();
    const srcUrl = eventSourceUrlInput.value.trim();
    const calendarId = calendarSelect.value;

    let recurrence = recurrenceFrequency !== 'NEVER' ? `RRULE:FREQ=${recurrenceFrequency}` : undefined;
    if(recurrence) {
        if (recurrenceCount) {
            recurrence += `;COUNT=${recurrenceCount}`;
        } else if (recurrenceEnd) {
            recurrence += `;UNTIL=${new Date(recurrenceEnd).toISOString().replace(/[-:.]/g, '')}`;
        }
    }
   

    if (summary && start && end && calendarId) {
        const event = {
            summary,
            start: {
                dateTime: new Date(start).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: new Date(end).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            sendUpdates: sendNotifications ? 'all' : 'none',
            supportsAttachments: true,
            status,
            visibility,
            guestsCanSeeOtherGuests,
            guestsCanModify,
            guestsCanInviteOthers
        };
        if(attendees) {
            event.attendees = attendees.split(',').map(email => ({ email: email.trim() }));
        }
        if(description) {
            event.description = description;
        }
        if(location) {
            event.location = location;
        }
        if(colorId) event.colorId = colorId;
        if(recurrence) event.recurrence = [recurrence];
        if(srcTitle && srcUrl) {
            event.source = {
                title:srcTitle,
                url:srcUrl
            }
        }

        // Handle multiple attachments
        const attachments = [];
        const attachmentDivs = document.querySelectorAll('.attachment');
        for (const div of attachmentDivs) {
            const attachmentFile = div.querySelector('.event-attachment').files[0];
            const attachmentUrl = div.querySelector('.event-attachment-url').value.trim();
            let attachmentId;
            let attachmentIconLink;

            if (attachmentFile) {
                try {
                    const response = await uploadAttachmentFile(attachmentFile);
                    attachmentId = response.id;

                    // Get the icon link for the attachment
                    const fileMetadata = await gdrive.getFileMetadata(attachmentId);
                    attachmentIconLink = fileMetadata.iconLink;

                    attachments.push({
                        fileId: attachmentId,
                        title: attachmentFile.name,
                        mimeType: attachmentFile.type,
                        iconLink: attachmentIconLink,
                    });
                } catch (error) {
                    console.error('Error uploading attachment:', error);
                    return;
                }
            }

            if (attachmentUrl) {
                attachments.push({
                    fileUrl: attachmentUrl,
                    title: attachmentUrl.split('/').pop(), // Extract the file name from the URL
                    mimeType: 'application/octet-stream', // Default MIME type, adjust as necessary
                    iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/octet-stream', // Placeholder icon, adjust as necessary
                });
            }
        }

        if (attachments.length > 0) {
            event.attachments = attachments;
        }

        // Add reminders if any
        const reminders = [];
        const reminderDivs = document.querySelectorAll('.reminder');
        reminderDivs.forEach(div => {
            const method = div.querySelector('.reminder-method').value;
            const minutes = parseInt(div.querySelector('.reminder-time').value, 10);
            if (method && !isNaN(minutes)) {
                reminders.push({
                    method,
                    minutes,
                });
            }
        });

        if (reminders.length > 0) {
            event.reminders = {
                useDefault: false,
                overrides: reminders,
            };
        }

        try {
            const createdEvent = await gdrive.createEvent(calendarId, event);

            // Share the attachment files with the same attendees
            for (const attachment of attachments) {
                if (attachment.fileId) {
                    await shareAttachmentFile(attachment.fileId, attendees, sendNotifications, emailMessage);
                }
            }

            renderCalendar();
            addEventModal.style.display = 'none';
        } catch (error) {
            console.error('Error creating event:', error);
        }
    }
});


//----------------
// TASK CALENDAR (bulleted todo list)
//----------------


const initializeTasksCalendar = async () => {
    const calendars = await gdrive.listAllCalendars();
    let tasksCalendar = calendars.find(calendar => calendar.summary === 'Tasks');
    if (!tasksCalendar) {
        await gdrive.createCalendar('Tasks');
        tasksCalendar = await gdrive.findCalendarByName('Tasks');
    }
    await loadTasksCalendars();
    renderTasks();
};

// Function to load tasks calendars into the dropdown
const loadTasksCalendars = async () => {
    const calendars = await gdrive.listAllCalendars();
    tasksCalendarSelect.innerHTML = '';
    calendars.forEach(calendar => {
        const option = document.createElement('option');
        option.value = calendar.id;
        option.textContent = calendar.summary;
        if(calendar.summary === 'Tasks') option.selected = true;
        tasksCalendarSelect.appendChild(option);
    });
};

// Function to render tasks from the selected calendar
const renderTasks = async () => {
    const selectedCalendarId = tasksCalendarSelect.value;
    if (!selectedCalendarId) return;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const events = await gdrive.listEvents(selectedCalendarId, today.toISOString(), tomorrow.toISOString());
    tasksList.innerHTML = '';
    let currentDay = today.toDateString();

    const addTaskToList = (day, event) => {
        if (day !== currentDay) {
            const dayHeader = document.createElement('li');
            dayHeader.textContent = day;
            tasksList.appendChild(dayHeader);
            currentDay = day;
        }
        const taskItem = document.createElement('li');
        taskItem.innerHTML = `<span>&#8226;</span> <span>${event.summary}</span> <span>${new Date(event.start.dateTime).toLocaleTimeString()}</span>`;
        taskItem.addEventListener('click', () => showEventDetails(event));
        tasksList.appendChild(taskItem);
    };

    events.forEach(event => {
        const eventDate = new Date(event.start.dateTime).toDateString();
        addTaskToList(eventDate, event);
    });
};

// Event listener to add a task
addTaskButton.addEventListener('click', () => {
    openAddEventModalButton.click(); // Reuse the Add Event modal
    eventSummaryInput.dataset.task = true; // Set a flag or specific identifier to ensure the task is added to the Tasks calendar
});




calendarSelect.addEventListener('change', renderCalendar);


//we need this to register PWA events, should propagate to active connections for the user as well
function isServiceWorkerActive() {
    return new Promise((resolve, reject) => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(registration) {
          if (navigator.serviceWorker.controller) {
            resolve(true);
          } else {
            resolve(false);
          }
        }).catch(function(error) {
          console.error('Service worker not ready:', error);
          resolve(false);
        });
      } else {
        console.log('Service workers are not supported in this browser.');
        resolve(false);
      }
    });
}
  
//   // Usage
//   isServiceWorkerActive().then(isActive => {
//     if (isActive) {
//       console.log('This app is a PWA with an active service worker.');
//       // You can now register for notifications
//     } else {
//       console.log('No active service worker.');
//     }
//   });

//todo: firebase push notifications to sync with tasks to give an ontime notification to re-engage the application

//Now we need to create a cycle with local FS and google drive for retaining tasks offline and 
//    using google calendars for updates which should sync and still work offline too.
// But we need to keep a buffer of non-synced data in case we are online and sync at the first available
//    as for syncing docs we need to make it optional to back it up

/**
* 
* Calendar Event
* 

//we should create a calendar event with a task, with a toggle whether to use google calendar or firebase cloud messaging for popup (push) reminders
type Event = {
    id:string; //should be in the metadata response
    summary: string;
    location?: string;
    description?: string;
    colorId?:string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    recurrence?: string[];
    attendees?: Attendee[]; //can assign others to help watch events
    reminders?: { //we can use either calendars or firebase, calendars should be used for like actual events while tasks should use firebase cloud messaging (free)
        useDefault: boolean;
        overrides: {method:'email'|'popup', minutes:number}[]; 
    };
    status?:'confirmed'|'tentative'|'cancelled';
    visibility?:'default'|'public'|'private'|'confidential';
    supportsAttachments?:boolean;
    guestsCanSeeOtherGuests?:boolean;
    guestsCanModify?:boolean;
    guestsCanInviteOthers?:boolean;
    sendUpdates?: 'all' | 'externalOnly' | 'none';
    source?:{
        title:string;
        url:string;
    }
    [key: string]: any; // To support additional properties
};


type UserTask = {
    eventId:string; //calendar event tied with this
    category:string; //categories let us aggregate data from multiple tasks over time.
    categoryFolderId?:string; //drive folder specific to this category
    folderId?:string; //drive folder specific to this task (keep things organized), local fs can only do single level folder so just do like category_filename for naming in local fs
    
    requirements:{ //required responses
        [key:string]:Survey|File|???;
        survey0:{ //e.g. a survey, with typical form inputs
            type:'survey'
            questions:[
                {
                    title:string;
                    response:null;
                    responseType?:'string'|'number'|'range'|'checkbox'
                    options?:('string'|'number'|'file')[]; //files saved in local fs first, only backed up if backup is enabled on this category
                    min?:number; //for ranges
                    max?:number;
                }
            ],
            path:string; //path in the local db
            fileName?:string; //file name used in local fs
            fileUrl?: string; //google drive backup path if used, we should have a toggle for if we want to preserve the file in local memory or pull from drive for download (to free up indexedb since it has limits)
        },
        file0:{
            type:'file'
            path:string; //path in the local db
            fileName?:string; //file name used in local fs 
            fileUrl?: string; //google drive backup path if used, we should have a toggle for if we want to preserve the file in local memory or pull from drive for download (to free up indexedb since it has limits)
            fileType?:string; //file input types accepted
        }
        //other includes? E.g. how about a game report so it can instantiate a simple js game and then store the results, we can expand this for like breathing exercises with pulse ox data streams captured

        //when set, save these responses locally in our fs for privacy, then include an option to backup to drive, which will also update events with fileUrls 
    };
    pushNotifications?:[ //style push notifications to create firebase cloud messaging notifications or if offline use local notifications (and then swap out if we come back online using a watch function)
        { time:string|number; message:string; options:[{ message:string; route:string|'dismiss'; }] } //should have buttons to open specific pages on response so we can jump to task forms or event reminders
    ];
}

//what we start with is a left side sidebar folder browser where we can create folders (categories) and then create tasks within these folders which utilize the input requirements and calendar event creation 

**/




/** potentially can use https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
 *  
 * Task - Title, Id, task options
 * 
 * 
 * Task options includes:
 * Data => csvs IDd for this task with question, choice, response, required fields
 *  - Form generator that reads/writes to the task-associated CSV
 *  [{prompt:'', input?:string|number|'radio'|'range'|'checklist' choices?:[], min?:number, max?:number, required?:boolean, response:any }] 
 *    -- save this json to the csv incl with the response when updated (overwrite to save state, too)
 * 
 * Docs => Upload files or select google drive files/folders to link from selector (use alternateLink structure)
 *    -- select and upload file to google drive OR select google drive file from list, modify our file browser
 *    -- get google drive metadata, use alternateLink for the attachments:[{fileUrl:alternateLink}]
 *    
 * Checkins - Will duplicate the task across multiple events
 * Reminders - versus checkins these are google calendar or email popups
 * 
 * Calendar Event => data for google calendar, will include summary
 * 
 * 
 */





// Event listeners
// form.addEventListener('submit', async (event) => {
//     event.preventDefault();
//     if (form.checkValidity()) {
//         const apiKey = document.getElementById('apikey').value.trim();
//         const clientId = document.getElementById('clientid').value.trim();
//         const directory = document.getElementById('directory').value.trim();
//         const useId = document.getElementById('useId').checked;

//         if (useId) {
//             gdrive.directoryId = directory;
//         } else {
//             gdrive.directory = directory;
//             gdrive.directoryId = '';
//         }

//         document.getElementById('file-browser-container').innerHTML = '';
//         await gdrive.initGapi(apiKey, clientId);
//         authButton.disabled = false;
//         authButton.click();
//     } else {
//         alert('Please fill in all required fields correctly.');
//     }
// });