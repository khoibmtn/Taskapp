import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getCountFromServer
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Common filters for all active tasks
 * @param {Array} baseConstraints - Existing where/orderBy constraints
 * @returns {Array} - Combined constraints
 */
const withActiveTaskFilters = (baseConstraints = []) => {
    return [
        where("isDeleted", "==", false),
        where("isArchived", "==", false),
        where("isRecurringTemplate", "==", false),
        ...baseConstraints
    ];
};

/**
 * Standardized Query Builder for Tasks
 */
export const getTasksQuery = ({
    uid,
    deptId,
    role, // 'assignee', 'supervisor', 'department'
    status, // 'all', 'open', 'completed'
    pageSize = 20,
    lastDoc = null,
    sortBy = 'dueAt',
    sortDir = 'asc'
}) => {
    const constraints = [];

    // 1. Role Scoping
    if (role === 'assignee' && uid) {
        constraints.push(where("assigneeUids", "array-contains", uid));
    } else if (role === 'supervisor' && uid) {
        constraints.push(where("supervisorId", "==", uid));
    } else if (role === 'department' && deptId) {
        constraints.push(where("departmentId", "==", deptId));
    }

    // 2. Status Filtering
    if (status === 'open') {
        constraints.push(where("status", "!=", "completed"));
    } else if (status === 'completed') {
        constraints.push(where("status", "==", "completed"));
    }

    // 3. Global Hidden Filters
    const filteredConstraints = withActiveTaskFilters(constraints);

    // 4. Sorting & Pagination
    // Important: Any field with an inequality filter MUST be the first orderBy field.
    if (status === 'open') {
        filteredConstraints.push(orderBy("status", "asc"));
    }

    // Default sorting
    filteredConstraints.push(orderBy(sortBy, sortDir));

    if (lastDoc) {
        filteredConstraints.push(startAfter(lastDoc));
    }

    filteredConstraints.push(limit(pageSize));

    return query(collection(db, "tasks"), ...filteredConstraints);
};

/**
 * Get count for a specific query scope
 */
export const getTaskCount = async ({ uid, deptId, role, status }) => {
    const constraints = [];
    if (role === 'assignee') constraints.push(where("assigneeUids", "array-contains", uid));
    else if (role === 'supervisor') constraints.push(where("supervisorId", "==", uid));
    else if (role === 'department') constraints.push(where("departmentId", "==", deptId));

    if (status === 'open') constraints.push(where("status", "!=", "completed"));
    else if (status === 'completed') constraints.push(where("status", "==", "completed"));

    const q = query(collection(db, "tasks"), ...withActiveTaskFilters(constraints));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
};
