/**
 * Copyright (c) 2022 Accenture. MIT licensed.
 * This Lightning Web Component contains a table that displays deployable Marketing Cloud metadata
 * that can be selected to be committed from one Business Unit to another.
 * Committed metadata will be included in the version control system and then deployed.
 *
 * This component should be placed on the Commit Changes (copado__User_Story_Commit) Tab.
 *
 * @see RunCopadoFunctionFromLWS.cls Apex Class
 *
 * {@link https://[Org].lightning.force.com/lightning/n/copado__User_Story_Commit?copado__recordId=[Id] Commit Changes (copado__User_Story_Commit) Tab }
 * Click the "Commit Changes" Button on the User Story Record Page to reach this page
 *
 */

// LWC from the official component library
import { LightningElement, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import {
    subscribe as subscribeEmp,
    unsubscribe as unsubscribeEmp,
    onError as onEmpError
} from "lightning/empApi";

// Apex Methods for retrieving and committing metadata (And Communication with the Copado Package)
// Apex functions to retrieve Recorddata from LWC
import ExecuteRetrieveFromCopado from "@salesforce/apex/mcdo_RunCopadoFunctionFromLWC.executeRetrieve";
import getMetadataFromEnvironment from "@salesforce/apex/mcdo_RunCopadoFunctionFromLWC.getMetadataFromEnvironment";
import getResultIds from "@salesforce/apex/mcdo_RunCopadoFunctionFromLWC.getResultIds";

// "Commit Changes" Page Tab related
import COMMIT_PAGE_COMMUNICATION_CHANNEL from "@salesforce/messageChannel/copado__CommitPageCommunication__c";
import {
    MessageContext,
    subscribe as subscribeMessageService,
    publish as publishMessageService
} from "lightning/messageService";

import { CurrentPageReference } from "lightning/navigation";

export default class mcdo_RetrieveTable extends LightningElement {
    // This will hold current Record ID
    currentPageReference;

    // This will hold current Record ID
    userStoryId;

    // This function retrieves the current Record ID from CurrentPageReference
    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        try {
            if (currentPageReference) {
                const userStoryId = currentPageReference.state.copado__recordId;
                this.userStoryId = userStoryId;
            }
        } catch (err) {
            console.error(`${err.name}: ${err.message}: `, err);
            this.showError(
                `${err.name}: An Error occurred while reading the Record ID from CurrentPageReference inside LWC`,
                `${err.message}`
            );
            console.error(
                "There might be a problem with CurrentPageReference: ",
                currentPageReference
            );
        }
    }

    @wire(MessageContext)
    _context;

    // Table Content
    data;
    visibleData; // Required to handle the search functionality

    // Static definition of the columns
    columns = [
        {
            label: "Name",
            fieldName: "n",
            type: "string",
            sortable: true
        },
        {
            label: "Key",
            fieldName: "k",
            type: "string",
            sortable: true
        },
        {
            label: "Type",
            fieldName: "t",
            type: "string",
            sortable: true
        },
        {
            label: "Directory",
            fieldName: "p",
            type: "string",
            sortable: true
        },
        {
            label: "Last Modified By",
            fieldName: "lb",
            type: "string",
            sortable: true
        },
        {
            label: "Last Modified Date",
            fieldName: "ld",
            type: "date",
            typeAttributes: {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            },
            sortable: true
        },
        {
            label: "Created By",
            fieldName: "cb",
            type: "string",
            sortable: true
        },
        {
            label: "Created Date",
            fieldName: "cd",
            type: "date",
            typeAttributes: {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            },
            sortable: true
        }
    ];

    // Row Selection
    selectedRowIDs = []; // used to tell the table which rows are selected
    selectedRowsIDsFiltered = [];

    // Sorting variables
    defaultSortDirection = "asc";
    sortDirection = "desc";
    sortedBy = "ld";

    // Search Functionality related variables
    keyword;
    allSelectedRows = [];

    // Loading State related variables
    isLoading = true;
    showTable = false;
    refreshButtonDisabled = true;
    progressStatus = "Loading data";
    currentResultIds = undefined;

    // Subscription related variables
    getProgressSubscription = {};
    reloadTableSubscription = {};
    resultChannelName = "/event/copado__MC_Result__e";
    eventChannelName = "/event/copado__Event__e";

    _subscribeToMessageService() {
        subscribeMessageService(this._context, COMMIT_PAGE_COMMUNICATION_CHANNEL, (message) => {
            this._handleCommitPageCommunicationMessage(message);
        });
    }

    /**
     * helper for commit action to pass on what was selected
     * @param {*} message
     */
    async _handleCommitPageCommunicationMessage(message) {
        try {
            this.loadingState(true);
            switch (message.type) {
                case "request":
                    this._handleRequestMessage(message);
                    break;
                // extension"
                case "retrievedChanges":
                case "pulledChanges":
                    break;
                default:
            }
        } catch (err) {
            console.error(`${err.name}: ${err.message}: `, err);
            this.showError(
                `${err.name}: An Error occurred while handling the Commit Page Communication Message:`,
                `${err.message}`
            );
        } finally {
            this.loadingState(false);
        }
    }

    /**
     * helper for commit action to pass on what was selected
     * reference: https://docs.copado.com/articles/#!copado-ci-cd-publication/executing-a-copado-action
     */
    _handleRequestMessage() {
        const uniqueIDs = [];
        const selectedChanges = this.allSelectedRows
            .map((item) => {
                if (uniqueIDs.includes(`${item.p}/${item.k};${item.t};${item.n}`)) {
                    // ensure have the same uniqueness rules as Copado Deployer v20
                    return null;
                }
                uniqueIDs.push(`${item.p}/${item.k};${item.t};${item.n}`);

                return {
                    m: item.p + "/" + item.k, // "module directory"; we include path AND key to ensure it becomes part of Copado's unique key, avoiding duplicate-errors
                    a: "add", // git action
                    c: "sfmc", // component
                    n: item.n, // metadata name
                    t: item.t, // metadata type
                    cd: item.cd, // metadata created datetime
                    cb: item.cb, // metadata created by name
                    ld: item.ld, // metadata last modified datetime
                    lb: item.lb, // metadata last modified by name
                    j: '{"key":"' + item.k + '"}' // additional info (used for metadata key)
                };
            })
            .filter(Boolean);

        const payload = {
            type: "changes",
            value: selectedChanges
        };
        publishMessageService(this._context, COMMIT_PAGE_COMMUNICATION_CHANNEL, payload);
    }

    // Subscribes initially to Message Service, Register the Error Listener for the Emp Api
    // Get Metadata from environment, Deactivate the Loading State
    connectedCallback() {
        try {
            this._subscribeToMessageService();
        } catch (err) {
            console.error(`${err.name}: ${err.message}: `, err);
            this.showError(
                `${err.name}: An Error occurred while subscribing to the message service:`,
                `${err.message}`
            );
        }

        try {
            this.registerEmpErrorListener();
        } catch (err) {
            console.error(`${err.name}: ${err.message}: `, err);
            this.showError(
                `${err.name}: An Error occured while registering the emp-API Error Listener:`,
                `${err.message}`
            );
        }

        // This Apex method gets the metadata from the last metadata.json File, that was created by the Retrieve Apex method
        try {
            getMetadataFromEnvironment({ userStoryId: this.userStoryId }).then((result) => {
                if (!result) {
                    this.showToastEvent(
                        "No Metadata found",
                        "No Metadata was found in the environment. Please retrieve the metadata first.",
                        "warning",
                        "sticky"
                    );
                    this.data = [];
                    this.visibleData = [...this.data];
                } else {
                    this.data = this.addIdToData(JSON.parse(result));
                    this.showToastEvent(
                        "Showing Metadata from your last Refresh",
                        `The below table with ${this.data.length} items from your Business Unit is loaded from cache. To get the most recent list please use the 'Refresh' button.`
                    );

                    this.visibleData = [...this.data];
                    this.sortData(this.sortedBy, this.sortDirection);
                }
                this.loadingState(false);
            });
        } catch (err) {
            this.loadingState(false);
            console.error("Error while fetching the Metadata from the Org: ", err);
            this.showError(
                `${err.name}: An error occurred while getting the metadata from the environment`,
                `${err.message}`
            );
        }
    }
    /**
     * adds an id field to the data to track what was selected and what wasnt across filter actions or pagination
     * @param {object} data our central list of data as retrieved from the json attached to the environment
     * @returns {object} data with an id field added
     */
    addIdToData(data) {
        return data.map((row) => {
            row.id = `${row.t}.${row.k}`;
            return row;
        });
    }

    /**
     * called when the Refresh-button is clicked to get new data from SFMC
     */
    async retrieve() {
        this.loadingState(true, "Starting Retrieve");

        try {
            const jobExecutionId = await ExecuteRetrieveFromCopado({
                userStoryId: this.userStoryId
            });
            this.subscribeToCompletionEvent(jobExecutionId);
        } catch (error) {
            this.loadingState(false);
            this.showError(
                `${error.name}: An error occurred during the execution of the retrieve`,
                error.message
            );

            // if previously Rows have been selected, set them as selected again
            if (this.selectedRows.length > 0) {
                this.selectedRows = this.selectedRows.map(({ id }) => id);
            }
        }
    }

    /**
     * helper for retrieve()
     * @param {string} jobExecutionId sfid
     * @returns {Promise<void>} resolves when the job is done
     */
    async subscribeToCompletionEvent(jobExecutionId) {
        // get result ID from Job step related to job execution
        try {
            this.currentResultIds = await getResultIds({ jobExecutionId: jobExecutionId });
        } catch (error) {
            console.error(`ERROR STATUS: ${error.status} ${error.statusText}`);
        }

        const progressMessageCallback = async (response) => {
            if (
                this.currentResultIds.includes(response?.data?.payload?.copado__ResultId__c) &&
                response?.data?.payload?.copado__Progress_Status__c
            ) {
                // show progress update to user
                this.progressStatus = response?.data?.payload?.copado__Progress_Status__c;
            }
        };

        const reloadTableCallBack = async (response) => {
            if (
                response.data.payload.copado__Topic_Uri__c ===
                `/execution-completed/${jobExecutionId}`
            ) {
                // retrieve is done: refresh table with new data
                this.updateMetadataGrid(response, jobExecutionId);
            }
        };

        try {
            this.getProgressSubscription = await subscribeEmp(
                this.resultChannelName,
                -1,
                progressMessageCallback
            );
        } catch (err) {
            this.showError(
                `${err.name}: An error occurred while subscribing to Emp API`,
                err.message
            );
        }

        try {
            this.reloadTableSubscription = await subscribeEmp(
                this.eventChannelName,
                -1,
                reloadTableCallBack
            );
        } catch (err) {
            this.showError(
                `${err.name}: An error occurred while subscribing to Emp API`,
                err.message
            );
        }
    }

    async unsubscribeThisSubscription(subscription) {
        try {
            unsubscribeEmp(subscription, () => {});
        } catch (err) {
            this.showError(
                `${err.name}: An error occurred while unsubscribing from Emp API`,
                err.message
            );
        }
    }

    /**
     * helper for retrieve() called when refreshing metadata is done to update the table
     * @param {object} response empApi response
     * @param {string} jobExecutionId sfid
     * @returns {Promise<void>} resolves when the job is done
     */
    async updateMetadataGrid(response, jobExecutionId) {
        this.unsubscribeThisSubscription(this.getProgressSubscription);
        this.unsubscribeThisSubscription(this.reloadTableSubscription);
        const jobExecution = JSON.parse(response.data.payload.copado__Payload__c);
        if (jobExecution.copado__Status__c === "Successful") {
            try {
                const result = JSON.parse(
                    await getMetadataFromEnvironment({ userStoryId: this.userStoryId })
                );
                this.showSuccess(
                    "Refresh done",
                    `Successfully loaded ${result.length} items from your Business Unit.`
                );
                this.data = this.addIdToData(result);
                this.visibleData = [...this.data];
                // apply sorting again
                this.sortData(this.sortedBy, this.sortDirection);
                this.loadingState(false);
            } catch (err) {
                this.loadingState(false);
                this.showError(
                    `${err.name}: Error fetching the Metadata from File after the Retrieve`,
                    err.message
                );
            }
        } else if (jobExecution.copado__Status__c === "Error") {
            this.loadingState(false);
            let JobUrl = "/" + jobExecutionId;
            const errEvent = new ShowToastEvent({
                title: "Error",
                variant: "error",
                mode: "sticky",
                message: "Refreshing metadata list failed. For more details {0}.",
                messageData: [
                    {
                        url: JobUrl,
                        label: "click here"
                    }
                ]
            });
            this.dispatchEvent(errEvent);
        } else {
            this.loadingState(false);
            this.showError(
                `Error while doing metadata retrieve: `,
                jobExecution.copado__ErrorMessage__c
            );
        }
    }
    /**
     * called when sorting is changed by user
     * @param {object} event LWC event object
     * @returns {void}
     */
    onHandleSort(event) {
        this.sortedBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortedBy, this.sortDirection);
    }

    /**
     * helper for onHandleSort that does the actual sorting
     * @param {string} fieldname this.sortedBy
     * @param {string} direction this.sortDirection
     * @returns {void}
     */
    sortData(fieldname, direction) {
        // create new array to trigger the update
        const visibleDataResorted = [...this.visibleData];
        // Return the value stored in the field
        let keyValue = (a) => {
            return a[fieldname];
        };
        // checking reverse direction
        let isReverse = direction === "asc" ? 1 : -1;
        // sorting data
        // might be null for new pipelines; also if response has special characters which then fails the JSON.parse
        if (visibleDataResorted) {
            visibleDataResorted.sort((next, prev) => {
                next = keyValue(next) ? keyValue(next) : ""; // handling null values
                prev = keyValue(prev) ? keyValue(prev) : "";
                // sorting values based on direction
                return isReverse * ((next > prev) - (prev > next));
            });
            // reset with newly created array from this method to trigger the update
            this.visibleData = visibleDataResorted;
        }
    }

    // Registers a listener to errors that the server returns by the empApi module
    registerEmpErrorListener() {
        onEmpError((error) => {
            this.showError(
                "There was a problem with empApi",
                "The server returned an error regarding the empApi module."
            );
            throw new Error(error);
        });
    }

    /**
     * called when a row is selected or deselected via its checkbox
     * @param {object} event LWC event object
     * @returns {void}
     */
    updateSelected(event) {
        // get rows that are selected AFTER the select/deselect that triggered calling this method
        const selectedRows = JSON.parse(JSON.stringify(event.detail.selectedRows));
        // Display that fieldName of the selected rows

        // add newly selected rows to the list of selected rows
        for (let i = 0; i < selectedRows.length; i++) {
            if (!this.selectedRowsIDsFiltered.includes(selectedRows[i].id)) {
                this.selectedRowsIDsFiltered.push(selectedRows[i].id);
                this.allSelectedRows.push(selectedRows[i]);
            }
        }
        // remove deselected rows from the list of selected rows
        const reducedSelectedRows = selectedRows.map((row) => row.id);
        for (let i = 0; i < this.selectedRowsIDsFiltered.length; i++) {
            if (!reducedSelectedRows.includes(this.selectedRowsIDsFiltered[i])) {
                this.selectedRowsIDsFiltered.splice(i, 1);
                const allIndex = this.allSelectedRows.findIndex(
                    (row) => row.id === this.selectedRowsIDsFiltered[i]
                );
                this.allSelectedRows.splice(allIndex, 1);
            }
        }
    }
    /**
     * Function that handles the search input field and the selectedRows of the table regarding the changing visible Data
     * @param {object} event LWC event object
     * @returns {void}
     */
    handleSearch(event) {
        // Filter Rows
        if (event.target.value === "") {
            // way faster in case the filter was cleared
            this.visibleData = [...this.data];
        } else {
            const regex = new RegExp(event.target.value, "gi"); // global and case insensitive match
            this.visibleData = this.data.filter(
                (row) =>
                    regex.test(row.n) ||
                    regex.test(row.t) ||
                    regex.test(row.p) ||
                    regex.test(row.cd) ||
                    regex.test(row.cb) ||
                    regex.test(row.ld) ||
                    regex.test(row.lb) ||
                    regex.test(row.k)
            );
        }
        // apply sorting again
        this.sortData(this.sortedBy, this.sortDirection);
        // Set selected Rows (needs to be a new array to trigger the update)
        this.selectedRowIDs = [...this.allSelectedRows.map(({ id }) => id)];

        // reset list for current filter to allow add/remove from global list
        this.selectedRowsIDsFiltered.length = 0;
        this.selectedRowsIDsFiltered.push(
            ...this.visibleData
                .filter((row) => this.selectedRowIDs.includes(row.id))
                .map(({ id }) => id)
        );
    }

    /**
     * General Handler for simple Inputs
     * @param {object} event LWC event object
     * @returns {void}
     */
    handleChange(event) {
        this[event.target.name] = event.detail.value;
    }

    /**
     * helper to show dynamic popups for various events
     * @param {string} title displayed as heading
     * @param {string} message body of the message. It can contain placeholders in the form of {0} ... {N}. The placeholders are replaced with the links on messageData.
     * @param {'info'|'success'|'warning'|'error'} [variant=info] Changes the appearance of the notice
     * @param {'dismissible'|'pester'|'sticky'} [mode=dismissible] Determines how persistent the toast is
     * @returns {void}
     */
    showToastEvent(title, message, variant, mode) {
        const event = new ShowToastEvent({
            title,
            message,
            variant,
            mode
        });
        this.dispatchEvent(event);
    }

    /**
     * show sticky error message
     * @param {string} title displayed as heading
     * @param {string} message body of the message. It can contain placeholders in the form of {0} ... {N}. The placeholders are replaced with the links on messageData.
     * @returns {void}
     */
    showError(title, message) {
        this.showToastEvent(title, message, "error", "sticky");
    }
    /**
     * show sticky error message
     * @param {string} title displayed as heading
     * @param {string} message body of the message. It can contain placeholders in the form of {0} ... {N}. The placeholders are replaced with the links on messageData.
     * @returns {void}
     */
    showSuccess(title, message) {
        this.showToastEvent(title, message, "success", "dismissible");
    }

    /**
     * shows loading spinner and progress message or hides it again
     * @param {boolean} isLoading shows/hides spinner
     * @param {string} [progressStatus] sets progress message
     * @returns {void}
     */
    loadingState(isLoading, progressStatus) {
        if (progressStatus) {
            this.progressStatus = progressStatus;
        }
        this.isLoading = isLoading;
        this.showTable = !isLoading;
        this.refreshButtonDisabled = isLoading;
    }
}
