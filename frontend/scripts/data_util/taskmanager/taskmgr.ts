import {GDrive, Event, Attendee} from '../GDrive'


// User task structure with integration capabilities
export type UserTask = {
    eventId: string; // Calendar event tied with this task
    category: string; // Categories let us aggregate data from multiple tasks over time
    categoryFolderId?: string; // Drive folder specific to this category
    folderId?: string; // Drive folder specific to this task
    requirements: { // Required responses
        [key: string]: Survey | File | OtherRequirement; // Flexibility for various types
        survey0: { // Example of a survey requirement
            type: 'survey';
            questions: {
                title: string;
                response: null;
                responseType?: 'string' | 'number' | 'range' | 'checkbox';
                options?: ('string' | 'number' | 'file')[];
                min?: number; // For ranges
                max?: number;
            }[];
            path: string; // Path in the local DB
            fileName?: string; // File name used in local FS
            fileUrl?: string; // Google Drive backup path if used
        };
        file0: { // Example of a file requirement
            type: 'file';
            path: string; // Path in the local DB
            fileName?: string; // File name used in local FS
            fileUrl?: string; // Google Drive backup path if used
            fileType?: string; // File input types accepted
        };
        // Additional includes can be added here, e.g., game reports, breathing exercises data, etc.
    };
    pushNotifications?: PushNotification[]; // Style push notifications for Firebase or local notifications
};

// Push notification structure for Firebase Cloud Messaging or local notifications
export type PushNotification = {
    time: string | number; // Time for the notification
    message: string; // Notification message
    options: NotificationOption[]; // Options for user responses
};

// Notification options for user interactions
export type NotificationOption = {
    title: string; // Button title
    action: string; // Action type, e.g., 'route' or 'dismiss'
    route?: string; // Route to open specific pages
};


export type Survey = {
    type: 'survey';
    questions: SurveyQuestion[];
    path: string;
    fileName?: string;
    fileUrl?: string;
};

export type SurveyQuestion = {
    title: string;
    response: null;
    responseType?: 'string' | 'number' | 'range' | 'checkbox';
    options?: ('string' | 'number' | 'file')[];
    min?: number;
    max?: number;
};

export type TaskFile = {
    type: 'file';
    path: string;
    fileName?: string;
    fileUrl?: string;
    fileType?: string;
};

export type OtherRequirement = {
    type: string;
    [key: string]: any; // To support various other types of requirements
};