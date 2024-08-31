/**
 * Task Management System
 * 
 * This application manages tasks locally, with the potential for Google Drive integration for backup and restore purposes.
 * It allows users to add tasks with detailed information, set reminders, and manage file attachments.
 * 
 * The main components include:
 * - Authentication and Initialization: Handles user sign-in and initializes the system.
 * - Task Management: Allows creating, viewing, and rendering tasks.
 * - Backup and Restore: Provides functionality to backup and restore tasks (currently commented out for local use).
 * - Folder Browser: Visualizes local folders and allows interaction with them.
 * - Requirements Management: Handles surveys and file inputs as task requirements.
 */

import { checkDirInit, appendFile, readFile, writeFile, formatPath } from '../IDButils';//'../zenfsUtils'//
import { checkFolderList, parseFolderList, visualizeDirectory } from '../fs_csv';

import './index.css';

// HTML elements
const authButton = document.getElementById('auth-button');
const addTaskButton = document.getElementById('add-task-button');
// const backupButton = document.getElementById('backup-button');
// const restoreButton = document.getElementById('restore-button');
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

// Modal elements for requirements
const surveyDialog = document.getElementById('survey-dialog');
const surveyForm = document.getElementById('survey-form');
const fileInputDialog = document.getElementById('file-input-dialog');
const fileInputForm = document.getElementById('file-input-form');

// Load and render tasks
const loadTasks = async () => {
    const tasks = await loadTasksFromLocal();
    renderTasks(tasks);
};

const loadTasksFromLocal = async () => {
    // Implement local task loading logic here
    return [];
};

const renderTasks = (tasks) => {
    tasksList.innerHTML = '';
    tasks.forEach(task => {
        const taskItem = document.createElement('li');
        taskItem.innerHTML = `<span>&#8226;</span> <span>${task.summary}</span> <span>${new Date(task.start).toLocaleTimeString()}</span>`;
        taskItem.addEventListener('click', () => showTaskDetails(task));
        tasksList.appendChild(taskItem);
    });
};

const showTaskDetails = (task) => {
    const taskDetailsContent = document.getElementById('task-details-content');
    taskDetailsContent.innerHTML = `
        <p><strong>Summary:</strong> ${task.summary}</p>
        <p><strong>Category:</strong> ${task.category}</p>
        <p><strong>Start:</strong> ${new Date(task.start).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(task.end).toLocaleString()}</p>
        <p><strong>Description:</strong> ${task.description || 'N/A'}</p>
        <button class="show-requirements-button" data-summary="${task.summary}">Show Requirements</button>
    `;
    document.getElementById('task-details-modal').showModal();
};

const showRequirements = async (taskSummary) => {
    const requirementsPath = formatPath(`/task_${taskSummary}/requirements.json`, '/data');
    const requirementsData = await readFile(requirementsPath);
    if (requirementsData) {
        const requirements = JSON.parse(requirementsData);
        // Render the requirements in a suitable format (e.g., list, table)
        const requirementsList = document.getElementById('requirements-list');
        requirementsList.innerHTML = '';
        for (const [key, req] of Object.entries(requirements)) {
            const reqItem = document.createElement('li');
            reqItem.innerHTML = `<span>${req.type}: ${req.title}</span>`;
            if (req.type === 'survey') {
                reqItem.innerHTML += `<button class="fill-survey-button" data-summary="${taskSummary}" data-key="${key}">Fill Survey</button>`;
            } else if (req.type === 'file') {
                reqItem.innerHTML += `<button class="upload-file-button" data-summary="${taskSummary}" data-key="${key}">Upload File</button>`;
            }
            requirementsList.appendChild(reqItem);
        }
        document.getElementById('requirements-dialog').showModal();
    }
};

const fillSurvey = async (taskSummary, surveyKey) => {
    // Load survey questions and show the survey modal
    const surveyPath = formatPath(`/task_${taskSummary}/survey_${surveyKey}.json`, '/data');
    const surveyData = await readFile(surveyPath);
    if (surveyData) {
        const survey = JSON.parse(surveyData);
        const surveyQuestionsDiv = document.getElementById('survey-questions');
        surveyQuestionsDiv.innerHTML = '';
        survey.questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.innerHTML = `
                <label>${question.title}</label>
                <input type="text" id="survey-question-${index}">
            `;
            surveyQuestionsDiv.appendChild(questionDiv);
        });
        surveyDialog.showModal();
        surveyForm.onsubmit = async (ev) => {
            ev.preventDefault();
            survey.questions.forEach((question, index) => {
                question.response = document.getElementById(`survey-question-${index}`).value;
            });
            await appendFile(surveyPath, JSON.stringify(survey));
            surveyDialog.close();
        };
    }
};

const uploadFileInput = (taskSummary, fileKey) => {
    // Show file input modal
    fileInputDialog.showModal();
    fileInputForm.onsubmit = async (ev) => {
        ev.preventDefault();
        const file = document.getElementById('file-input').files[0];
        const filePath = formatPath(`/task_${taskSummary}/${fileKey}`, '/data');
        const fileBuffer = await readFileBuffer(file);
        if (fileBuffer) {
            await appendFile(filePath, fileBuffer);
            fileInputDialog.close();
        }
    };
};

// Task management
addTaskButton.addEventListener('click', () => {
    addTaskForm.reset();
    addTaskModal.showModal();
});

addTaskForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const summary = taskSummaryInput.value.trim();
    const category = taskCategoryInput.value.trim();
    const start = taskStartInput.value;
    const end = taskEndInput.value;
    const description = taskDescriptionInput.value.trim();

    const task = {
        summary,
        description: JSON.stringify({
            description,
            category,
            requirements: await collectRequirements(summary)
        }),
        start: {
            dateTime: new Date(start).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
            dateTime: new Date(end).toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        supportsAttachments: true,
        attachments: await collectAttachments(summary)
    };

    try {
        // Save the task locally in its own folder
        await saveTaskLocally(task, summary);

        // Reload tasks and reset the form
        await loadTasks();
        addTaskForm.reset();
        addTaskModal.close();
    } catch (error) {
        console.error('Error creating task:', error);
    }
});

document.querySelector('#add-task-modal .close').addEventListener('click', () => {
    addTaskModal.close();
});

eventReminderCheckbox.addEventListener('change', (e) => {
    remindersSection.style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('tasks-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('show-requirements-button')) {
        const summary = e.target.getAttribute('data-summary');
        showRequirements(summary);
    }
});

document.getElementById('requirements-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('fill-survey-button')) {
        const summary = e.target.getAttribute('data-summary');
        const key = e.target.getAttribute('data-key');
        fillSurvey(summary, key);
    } else if (e.target.classList.contains('upload-file-button')) {
        const summary = e.target.getAttribute('data-summary');
        const key = e.target.getAttribute('data-key');
        uploadFileInput(summary, key);
    }
});

const collectRequirements = async (taskSummary) => {
    const requirements = {};
    const requirementDivs = document.querySelectorAll('.requirement');
    for (let index = 0; index < requirementDivs.length; index++) {
        const div = requirementDivs[index];
        const title = div.querySelector('.requirement-title').value.trim();
        const type = div.querySelector('.requirement-type').value.trim();
        const questions = div.querySelector('.requirement-questions').value.trim();
        const file = div.querySelector('.requirement-file').files[0];
        const fileUrl = div.querySelector('.requirement-file-url').value.trim();

        if (type === 'survey') {
            requirements[`survey${index}`] = {
                type,
                title,
                questions: questions.split('\n').map(question => ({
                    title: question,
                    response: null
                }))
            };
            const surveyPath = formatPath(`/task_${taskSummary}/survey_${index}.json`, '/data');
            await writeFile(surveyPath, JSON.stringify(requirements[`survey${index}`]));
        } else if (type === 'file' && (file || fileUrl)) {
            let filePath;
            let fileName;
            let fileType;
            if (file) {
                const fileBuffer = await readFileBuffer(file);
                if (fileBuffer) {
                    filePath = formatPath(`/task_${taskSummary}/${file.name}`, `/data`);
                    fileName = file.name;
                    fileType = file.type;
                    await writeFile(filePath, fileBuffer);
                }
            } else {
                filePath = fileUrl;
                fileName = fileUrl.split('/').pop();
                fileType = 'application/octet-stream';
            }
            requirements[`file${index}`] = {
                type,
                path: filePath,
                title,
                fileName: fileName || undefined,
                fileUrl: fileUrl || undefined,
                fileType: fileType || undefined
            };
        }
    }
    const requirementsPath = formatPath(`/task_${taskSummary}/requirements.json`, '/data');
    await writeFile(requirementsPath, JSON.stringify(requirements));
    return requirements;
};

const collectAttachments = async (taskSummary) => {
    const attachments = [];
    if (taskAttachmentInput.files.length > 0) {
        const attachmentFile = taskAttachmentInput.files[0];
        const fileBuffer = await readFileBuffer(attachmentFile);
        if (fileBuffer) {
            const filePath = formatPath(`/task_${taskSummary}/${attachmentFile.name}`, `/data`);
            await writeFile(filePath, fileBuffer);
            attachments.push({
                title: attachmentFile.name,
                mimeType: attachmentFile.type
            });
        }
    }
    if (taskAttachmentUrlInput.value) {
        attachments.push({
            fileUrl: taskAttachmentUrlInput.value,
            title: taskAttachmentUrlInput.value.split('/').pop(),
            mimeType: 'application/octet-stream'
        });
    }
    return attachments.length > 0 ? attachments : undefined;
};

const readFileBuffer = (file) => {
    return new Promise((resolve, reject) => {
        if (file.size > 100 * 1024 * 1024) {
            alert('File size exceeds 100 MB limit');
            return resolve(null);
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

const saveTaskLocally = async (task, taskSummary) => {

    checkFolderList(`/task_${taskSummary}`)
    // Save task details to the task's folder
    const taskDetailsPath = formatPath(`/task_${taskSummary}/details.json`, '/data');
    await writeFile(taskDetailsPath, JSON.stringify(task));
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
const loadFolders = async () => {
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
                visualizeDirectory('/data'+folder, subfolderContainer);
            } else {
                subfolderContainer.innerHTML = '';
            }
        });
    };

    folders.forEach(folder => createFolderItem(folder, folderBrowser));
};

const loadIDBFolderBrowser = async () => {
    await loadFolders();  // Make sure folders are loaded initially
    await simulateTaskCreation();  // Simulate task creation and ensure folders are refreshed afterwards
    setTimeout(async ()=>{await loadFolders()},200); ///todo fix await time
};





const simulateTaskCreation = async () => {
    const timestamp = Date.now();
    const summary = `${timestamp}`;
    const category = 'General';
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 3600000).toISOString(); // 1 hour later
    const description = `This is a simulated task created at ${new Date(timestamp).toLocaleString()}.`;

    const requirements = [
        {
            type: 'survey',
            title: 'Survey Requirement',
            questions: [
                { title: 'How satisfied are you?', response: null },
                { title: 'What can be improved?', response: null }
            ]
        },
        {
            type: 'file',
            title: 'File Requirement',
            fileName: 'example.txt',
            fileContent: 'This is an example file content for the task.'
        }
    ];

    const attachments = [
        {
            title: 'Attachment 1',
            mimeType: 'text/plain',
            content: 'This is the content of attachment 1.'
        },
        {
            title: 'Attachment 2',
            mimeType: 'text/plain',
            content: 'This is the content of attachment 2.'
        }
    ];

    const task = {
        summary,
        description: JSON.stringify({
            description,
            category,
            requirements
        }),
        start: {
            dateTime: start,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
            dateTime: end,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        supportsAttachments: true,
        attachments: attachments.map(att => ({
            title: att.title,
            mimeType: att.mimeType
        }))
    };

    await saveTaskLocally(task, summary);

    for (let i = 0; i < requirements.length; i++) {
        if (requirements[i].type === 'survey') {
            const surveyPath = formatPath(`/task_${summary}/survey_${i}.json`, '/data');
            await writeFile(surveyPath, JSON.stringify(requirements[i]));
        } else if (requirements[i].type === 'file') {
            const filePath = formatPath(`/task_${summary}/${requirements[i].fileName}`, '/data');
            await writeFile(filePath, requirements[i].fileContent);
        }
    }

    for (let i = 0; i < attachments.length; i++) {
        const attachmentPath = formatPath(`/task_${summary}/attachment_${i}.txt`, '/data');
        await writeFile(attachmentPath, attachments[i].content);
    }

    console.log(`Task "${summary}" created successfully.`);
};

//loadIDBFolderBrowser();