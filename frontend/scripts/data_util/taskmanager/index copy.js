import { GFileBrowser } from '../GDrive';
import { FS_Drive } from '../fs_drive';
import { appendFile, readFile, formatPath } from '../zenfsUtils';
import {checkFolderList, parseFolderList, visualizeDirectory} from '../fs_csv'

const gdrive = new GFileBrowser(apiKey, clientId, "AppData");
const fsDrive = new FS_Drive(gdrive);

// HTML elements
const authButton = document.getElementById('auth-button');
const addTaskButton = document.getElementById('add-task-button');
const backupButton = document.getElementById('backup-button');
const restoreButton = document.getElementById('restore-button');
const filenameInput = document.getElementById('filename-input');
const tasksList = document.getElementById('tasks-list');
const folderBrowser = document.getElementById('folder-browser');

const addTaskModal = document.getElementById('add-task-modal');
const addTaskForm = document.getElementById('add-task-form');
const taskSummaryInput = document.getElementById('task-summary');
const taskCategoryInput = document.getElementById('task-category');
const taskStartInput = document.getElementById('task-start');
const taskEndInput = document.getElementById('task-end');
const taskDescriptionInput = document.getElementById('task-description');
const taskAttachmentInput = document.getElementById('task-attachment');
const taskAttachmentUrlInput = document.getElementById('task-attachment-url');
const addRequirementButton = document.getElementById('add-requirement-button');
const requirementsSection = document.getElementById('requirements-section');
const eventReminderCheckbox = document.getElementById('event-reminder-checkbox');
const remindersSection = document.getElementById('reminders-section');
const addReminderButton = document.getElementById('add-reminder-button');

// Authentication and initialization
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
        await loadTasks();
        gdrive.createFileBrowser('file-browser-container');
        gdrive.createFileUploader('file-browser-container');
    }
    authButton.innerText = 'Sign Out';
    authButton.onclick = async () => {
        await gdrive.signOut();
        authButton.onclick = onAuthClick;
    }
};
authButton.onclick = onAuthClick;

// Load and render tasks
const loadTasks = async () => {
    const tasksCalendar = await getOrCreateTasksCalendar();
    const events = await gdrive.listEvents(tasksCalendar.id);
    renderTasks(events);
};

const getOrCreateTasksCalendar = async () => {
    const calendars = await gdrive.listAllCalendars();
    let tasksCalendar = calendars.find(calendar => calendar.summary === 'Tasks');
    if (!tasksCalendar) {
        await gdrive.createCalendar('Tasks');
        tasksCalendar = await gdrive.findCalendarByName('Tasks');
    }
    return tasksCalendar;
};

const renderTasks = (events) => {
    tasksList.innerHTML = '';
    events.forEach(event => {
        const taskItem = document.createElement('li');
        taskItem.innerHTML = `<span>&#8226;</span> <span>${event.summary}</span> <span>${new Date(event.start.dateTime).toLocaleTimeString()}</span>`;
        taskItem.addEventListener('click', () => showTaskDetails(event));
        tasksList.appendChild(taskItem);
    });
};

const showTaskDetails = (event) => {
    const taskDetailsContent = document.getElementById('task-details-content');
    taskDetailsContent.innerHTML = `
        <p><strong>Summary:</strong> ${event.summary}</p>
        <p><strong>Category:</strong> ${event.description}</p>
        <p><strong>Start:</strong> ${new Date(event.start.dateTime).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(event.end.dateTime).toLocaleString()}</p>
        <p><strong>Description:</strong> ${event.description || 'N/A'}</p>
    `;
    document.getElementById('task-details-modal').style.display = 'block';
};

// Backup and Restore
const backupData = async () => {
    const filename = filenameInput.value.trim();
    if (filename) {
        const tasksCalendar = await getOrCreateTasksCalendar();
        const events = await gdrive.listEvents(tasksCalendar.id);
        const data = JSON.stringify(events);
        const path = formatPath(`/${filename}.json`, '/data');
        await appendFile(path, data);
        await fsDrive.backupFS_CSVToDrive(path);
        console.log(`Backup to Drive completed for ${filename}.json`);
    }
};

const restoreData = async () => {
    const filename = filenameInput.value.trim();
    if (filename) {
        const path = formatPath(`/${filename}.json`, '/data');
        await fsDrive.driveToLocalDB({ id: filename, name: filename });
        const data = await readFile(path);
        if (data) {
            const events = JSON.parse(data);
            renderTasks(events);
            console.log(`Restore from Drive completed for ${filename}.json`);
        }
    }
};

backupButton.addEventListener('click', backupData);
restoreButton.addEventListener('click', restoreData);

// Task management
addTaskButton.addEventListener('click', () => {
    addTaskForm.reset();
    addTaskModal.style.display = 'block';
});

addTaskForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const summary = taskSummaryInput.value.trim();
    const category = taskCategoryInput.value.trim();
    const start = taskStartInput.value;
    const end = taskEndInput.value;
    const description = taskDescriptionInput.value.trim();
    const calendarId = (await getOrCreateTasksCalendar()).id;
    const attachments = [];
    const useEventReminders = eventReminderCheckbox.checked;

    if (taskAttachmentInput.files.length > 0) {
        const attachmentFile = taskAttachmentInput.files[0];
        const response = await uploadAttachmentFile(attachmentFile, category, summary);
        attachments.push({
            fileId: response.id,
            title: attachmentFile.name,
            mimeType: attachmentFile.type
        });
    }

    if (taskAttachmentUrlInput.value) {
        attachments.push({
            fileUrl: taskAttachmentUrlInput.value,
            title: taskAttachmentUrlInput.value.split('/').pop(),
            mimeType: 'application/octet-stream'
        });
    }

    const event = {
        summary,
        description: JSON.stringify({ 
            description, 
            category, 
            requirements: {} 
        }), // Placeholder for now
        start: {
            dateTime: new Date(start).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
            dateTime: new Date(end).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        supportsAttachments: true,
        attachments: attachments.length > 0 ? attachments : undefined
    };

    if (useEventReminders) {
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
    }

    try {
        const createdEvent = await gdrive.createEvent(calendarId, event);
        const taskFolder = await createTaskFolder(category, summary);
        const task = {
            eventId: createdEvent.id,
            category,
            categoryFolderId: taskFolder.categoryFolderId,
            folderId: taskFolder.folderId,
            requirements: collectRequirements(taskFolder.folderId),
            pushNotifications: collectPushNotifications()
        };
        await saveTaskLocally(task);
        await loadTasks();
        addTaskForm.reset(); //reset form inputs
        addTaskModal.style.display = 'none';
    } catch (error) {
        console.error('Error creating task:', error);
    }
});

document.querySelector('#add-task-modal .close').addEventListener('click', () => {
    addTaskModal.style.display = 'none';
});

eventReminderCheckbox.addEventListener('change', (e) => {
    remindersSection.style.display = e.target.checked ? 'block' : 'none';
});

const createTaskFolder = async (category, summary) => {
    const categoryFolderId = (await gdrive.checkFolder(category)).id;
    const taskFolderName = `${category}_${summary}`;
    const taskFolderId = (await gdrive.checkFolder(taskFolderName, undefined, undefined, categoryFolderId)).id;
    return {
        categoryFolderId,
        folderId: taskFolderId
    };
};

const collectRequirements = (taskFolderId) => {
    const requirements = {};
    const requirementDivs = document.querySelectorAll('.requirement');
    requirementDivs.forEach((div, index) => {
        const title = div.querySelector('.requirement-title').value.trim();
        const type = div.querySelector('.requirement-type').value.trim();
        const questions = div.querySelector('.requirement-questions').value.trim();
        const file = div.querySelector('.requirement-file').files[0];
        const fileUrl = div.querySelector('.requirement-file-url').value.trim();

        if (type === 'survey') {
            requirements[`survey${index}`] = {
                type,
                questions: questions.split('\n').map(question => ({
                    title: question,
                    response: null
                })),
                path: formatPath(`/survey_${index}.json`, taskFolderId)
            };
        } else if (type === 'file' && (file || fileUrl)) {
            const filePath = file ? formatPath(`/${file.name}`, taskFolderId) : fileUrl;
            requirements[`file${index}`] = {
                type,
                path: filePath,
                fileName: file ? file.name : undefined,
                fileUrl: fileUrl || undefined,
                fileType: file ? file.type : undefined
            };
        }
    });
    return requirements;
};

const collectPushNotifications = () => {
    const notifications = [];
    // Implement logic to collect push notification details
    return notifications;
};

const saveTaskLocally = async (task) => {
    const path = formatPath(`/task_${task.eventId}.json`, task.folderId);
    const data = JSON.stringify(task);
    await appendFile(path, data);
};

// Function to upload an attachment file to Google Drive
const uploadAttachmentFile = async (file, category, summary) => {
    const uploadProgress = document.createElement('progress');
    document.body.appendChild(uploadProgress);
    try {
        const categoryFolderId = (await gdrive.checkFolder(category)).id;
        const taskFolderName = `${category}_${summary}`;
        const taskFolderId = (await gdrive.checkFolder(taskFolderName, undefined, undefined, categoryFolderId)).id;

        const response = await gdrive.uploadFileToGoogleDrive(file, file.name, file.type, taskFolderId, (progressEvent) => {
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

// Function to add a requirement input field
const addRequirementField = () => {
    const requirementDiv = document.createElement('div');
    requirementDiv.classList.add('requirement');
    requirementDiv.innerHTML = `
        <input type="text" class="requirement-title" placeholder="Requirement Title">
        <select class="requirement-type">
            <option value="survey">Survey</option>
            <option value="file">File</option>
        </select>
        <textarea class="requirement-questions" placeholder="Questions (for Survey)"></textarea>
        <input type="file" class="requirement-file">
        <input type="url" class="requirement-file-url" placeholder="File URL">
    `;
    requirementsSection.appendChild(requirementDiv);
};

addRequirementButton.addEventListener('click', addRequirementField);

addReminderButton.addEventListener('click', () => {
    const reminderDiv = document.createElement('div');
    reminderDiv.classList.add('reminder');
    reminderDiv.innerHTML = `
        <select class="reminder-method">
            <option value="popup">Popup</option>
            <option value="email">Email</option>
        </select>
        <input type="number" class="reminder-time" placeholder="Minutes before event">
    `;
    remindersSection.appendChild(reminderDiv);
});

// Folder Browser
const loadLocalFolderBrowser = async () => {
    const folders = await parseFolderList();
    const folderBrowser = document.getElementById('folder-browser');
    folderBrowser.innerHTML = '';

    const createFolderItem = (folder, parent) => {
        const folderItem = document.createElement('div');
        folderItem.classList.add('folder-item');
        folderItem.innerHTML = `<span>${folder}</span>`;

        const subfolderContainer = document.createElement('div');
        subfolderContainer.classList.add('subfolder-container');

        folderItem.appendChild(subfolderContainer);
        parent.appendChild(folderItem);

        folderItem.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (subfolderContainer.innerHTML === '') {
                visualizeDirectory(folder, subfolderContainer);
            } else {
                subfolderContainer.innerHTML = '';
            }
        });
    };

    folders.forEach(folder => createFolderItem(folder, folderBrowser));
};

loadLocalFolderBrowser();