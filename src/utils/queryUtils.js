import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    or,
    and,
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
    role, // 'assignee', 'supervisor', 'department', 'related'
    status, // 'all', 'open', 'completed'
    pageSize = 20,
    lastDoc = null,
    sortBy = 'createdAt',
    sortDir = 'desc'
}) => {
    // 1. Collect all Filter constraints
    const filterConstraints = [];

    // Role Scoping
    if (role === 'assignee' && uid) {
        filterConstraints.push(where("assigneeUids", "array-contains", uid));
    } else if (role === 'supervisor' && uid) {
        filterConstraints.push(where("supervisorId", "==", uid));
    } else if (role === 'department' && deptId) {
        filterConstraints.push(where("departmentId", "==", deptId));
    } else if (role === 'related' && uid) {
        filterConstraints.push(or(
            where("assigneeUids", "array-contains", uid),
            where("supervisorId", "==", uid)
        ));
    }

    // Status Filtering
    if (status === 'open') {
        filterConstraints.push(where("status", "!=", "completed"));
    } else if (status === 'completed') {
        filterConstraints.push(where("status", "==", "completed"));
    }

    // Global filters
    const allFilters = withActiveTaskFilters(filterConstraints);

    // 2. Collect Modifiers (OrderBy, Limit, StartAfter)
    const modifiers = [];

    if (status === 'open') {
        modifiers.push(orderBy("status", "asc"));
    }
    modifiers.push(orderBy(sortBy, sortDir));
    if (lastDoc) {
        modifiers.push(startAfter(lastDoc));
    }
    modifiers.push(limit(pageSize));

    // 3. Compose Query
    // Validate: If we use OR, we must wrap all filters in AND? 
    // Actually, explicit 'and()' is robust for all cases with >1 filter.
    if (allFilters.length > 1) {
        return query(collection(db, "tasks"), and(...allFilters), ...modifiers);
    } else {
        return query(collection(db, "tasks"), ...allFilters, ...modifiers);
    }
};

/**
 * Get count for a specific query scope
 */
export const getTaskCount = async ({ uid, deptId, role, status }) => {
    const filterConstraints = [];

    // Role
    if (role === 'assignee') filterConstraints.push(where("assigneeUids", "array-contains", uid));
    else if (role === 'supervisor') filterConstraints.push(where("supervisorId", "==", uid));
    else if (role === 'department') filterConstraints.push(where("departmentId", "==", deptId));
    else if (role === 'related') filterConstraints.push(or(where("assigneeUids", "array-contains", uid), where("supervisorId", "==", uid)));

    // Status
    if (status === 'open') {
        filterConstraints.push(where("status", "!=", "completed"));
    } else if (status === 'completed') {
        filterConstraints.push(where("status", "==", "completed"));
    }

    // Combine with global filters
    const allFilters = withActiveTaskFilters(filterConstraints);

    // Explicit modifiers relevant for index matching specific to 'open' status inequality
    const modifiers = [];
    if (status === 'open') {
        modifiers.push(orderBy("status", "asc"));
    }

    let q;
    if (allFilters.length > 1) {
        q = query(collection(db, "tasks"), and(...allFilters), ...modifiers);
    } else {
        q = query(collection(db, "tasks"), ...allFilters, ...modifiers);
    }

    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
};
