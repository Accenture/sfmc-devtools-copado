/**
 *
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
import ExecuteRetrieveFromCopado from "@salesforce/apex/mcdo_RunCopadoFunctionFromLWC.executeRetrieve";
import getMetadataFromEnvironment from "@salesforce/apex/mcdo_RunCopadoFunctionFromLWC.getMetadataFromEnvironment";

// Apex functions to retrieve Recorddata from LWC

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
            this.showToastEvent(
                `${err.name}: An Error occurred while reading the Record ID from CurrentPageReference inside LWC`,
                `${err.message}`,
                "error",
                "sticky"
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
    selectedRows = [];

    // Sorting variables
    defaultSortDirection = "asc";
    sortDirection = "asc";
    sortedBy = "ld";

    // Search Functionality related variables
    keyword;
    allSelectedRows = [];
    missingSelectedRows = [];
    newSelectedRows = [];

    // Loading State related variables
    isLoading = true;
    showTable = false;
    refreshButtonDisabled = true;
    progressStatus = "Starting Retrieve";

    // Subscription related variables
    empSubscription = {};
    channelName = "/event/copado__Event__e";

    _subscribeToMessageService() {
        subscribeMessageService(this._context, COMMIT_PAGE_COMMUNICATION_CHANNEL, (message) =>
            this._handleCommitPageCommunicationMessage(message)
        );
    }

    async _handleCommitPageCommunicationMessage(message) {
        try {
            console.log("_handleCommitPageCommunicationMessage(message): ", message);
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
            this.showToastEvent(
                `${err.name}: An Error occurred while handling the Commit Page Communication Message:`,
                `${err.message}`,
                "error",
                "sticky"
            );
        } finally {
            this.loadingState(false);
        }
    }

    _handleRequestMessage() {
        console.log("_handleRequestMessage runs now");
        const selectedRows = this.template.querySelector("lightning-datatable").getSelectedRows();
        const selectedChanges = [];
        for (let i = 0; i < selectedRows.length; i++) {
            selectedChanges.push({
                m: "",
                a: "add",
                c: "sfmc",
                n: selectedRows[i].n,
                t: selectedRows[i].t,
                cd: selectedRows[i].cd,
                cb: selectedRows[i].cb,
                ld: selectedRows[i].ld,
                lb: selectedRows[i].lb,
                j: '{"key":"' + selectedRows[i].k + '"}'
            });
        }

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
            this.showToastEvent(
                `${err.name}: An Error occurred while subscribing to the message service:`,
                `${err.message}`,
                "error",
                "sticky"
            );
        }

        try {
            this.registerEmpErrorListener();
        } catch (err) {
            console.error(`${err.name}: ${err.message}: `, err);
            this.showToastEvent(
                `${err.name}: An Error occured while registering the emp-API Error Listener:`,
                `${err.message}`,
                "error",
                "sticky"
            );
        }

        // This Apex method gets the metadata from the last metadata.json File, that was created by the Retrieve Apex method
        try {
            console.log(
                "Running Initial getMetadataFromEnvironment, this is the userStoryId: ",
                this.userStoryId
            );
            getMetadataFromEnvironment({ userStoryId: this.userStoryId }).then((result) => {
                this.data = this.addIdToData(JSON.parse(result));
                this.visibleData = [...this.data];
                this.sortData(this.sortedBy, this.sortDirection);
            });
        } catch (err) {
            console.error("Error while fetching the Metadata from the Org: ", err);
            this.showToastEvent(
                `${err.name}: An error occurred while getting the metadata from the environment`,
                `${err.message}`,
                "error",
                "sticky"
            );
        } finally {
            this.loadingState(false);
        }
    }

    addIdToData(data) {
        const test = data.map((row, index) => {
            row.id = `${row.t}.${row.k}`;
            return row;
        });
        console.log(test);
        return test;
    }

    // Function to get the newest Committable Metadata, and save it in the environment
    async retrieve() {
        this.loadingState(true);

        try {
            this.progressStatus = "Starting Retrieve";
            const jobExecutionId = await ExecuteRetrieveFromCopado({
                userStoryId: this.userStoryId
            });
            this.subscribeToCompletionEvent(jobExecutionId);
        } catch (error) {
            this.showError(
                `${error.name}: An error occurred during the execution of the retrieve`,
                error.message
            );
            this.loadingState(false);

            // if previously Rows have been selected, set them as selected again
            if (self.selectedRows.length > 0) {
                self.selectedRows = self.selectedRows.map(({ id }) => id);
            }
        }
    }

    async subscribeToCompletionEvent(jobExecutionId) {
        const messageCallback = async (response) => {
            console.log("Event callback: ", JSON.parse(JSON.stringify(response)));

            if (
                response.data.payload.copado__Topic_Uri__c ===
                `/execution-completed/${jobExecutionId}`
            ) {
                // retrieve is done: refresh table with new data
                this.updateMetadataGrid(response, jobExecutionId);
            } else if (
                response.data.payload.copado__Topic_Uri__c.startsWith(
                    "/events/copado/v1/step-monitor/"
                )
            ) {
                try {
                    // show progress on screen
                    const stepStatus = JSON.parse(response.data.payload.copado__Payload__c);
                    this.progressStatus = stepStatus.data.progressStatus || this.progressStatus;
                } catch {}
            }
        };

        try {
            this.empSubscription = await subscribeEmp(this.channelName, -1, messageCallback);
        } catch (err) {
            this.showError(
                `${err.name}: An error occurred while subscribing to Emp API`,
                err.message
            );
        }
    }

    async updateMetadataGrid(response, jobExecutionId) {
        try {
            unsubscribeEmp(this.empSubscription);
        } catch (err) {
            this.showError(
                `${err.name}: An error occurred while unsubscribing from Emp API`,
                err.message
            );
        }

        const jobExecution = JSON.parse(response.data.payload.copado__Payload__c);
        if (jobExecution.copado__Status__c === "Successful") {
            try {
                const result = await getMetadataFromEnvironment({ userStoryId: this.userStoryId });
                this.data = this.addIdToData(JSON.parse(result));
                this.visibleData = [...this.data];
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
            this.showError(
                `Error while doing metadata retrieve: `,
                jobExecution.copado__ErrorMessage__c
            );
            this.loadingState(false);
        }
    }

    onHandleSort(event) {
        this.sortedBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortedBy, this.sortDirection);
    }

    sortData(fieldname, direction) {

        const visibleDataResorted = [...this.visibleData];
        // Return the value stored in the field
        let keyValue = (a) => {
            return a[fieldname];
        };
        // cheking reverse direction
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
            this.visibleData = visibleDataResorted;
        }
    }

    // Registers a listener to errors that the server returns by the empApi module
    registerEmpErrorListener() {
        onEmpError((error) => {
            this.showToastEvent(
                "There was a problem with empApi",
                "The server returned an error regarding the empApi module.",
                "error",
                "sticky"
            );
            throw new Error(error);
        });
    }
    updateSelected(event) {
        const selectedRows = event.detail.selectedRows;
        // Display that fieldName of the selected rows
        console.log("updateSelected-selectedRows: ", JSON.parse(JSON.stringify(selectedRows)));
    }
    /**
     * Function that handles the search input field and the selectedRows of the table regarding the changing visible Data
     * TODO: It's not possible to remove a row, when the dataset is reduced (search)
     */
    handleSearch(event) {
        const visibleSelectedRowsBefore = this.template
            .querySelector("lightning-datatable")
            .getSelectedRows();
        console.log(
            "handleSearch-1-selectedRows",
            JSON.parse(JSON.stringify(visibleSelectedRowsBefore))
        );
        event.detail.selectedRows;
        console.log("handleSearch-1-this.allSelectedRows", this.allSelectedRows);

        this.allSelectedRows = [
            ...new Set([...this.allSelectedRows, ...visibleSelectedRowsBefore])
        ];

        // Filter Rows
        const regex = new RegExp(event.target.value, "gi"); // global and case insensitive match
        this.visibleData = this.data.filter(
            (row) =>
                regex.test(row.n) ||
                regex.test(row.t) ||
                regex.test(row.cd) ||
                regex.test(row.cb) ||
                regex.test(row.ld) ||
                regex.test(row.lb) ||
                regex.test(row.k)
        );

        // Set selected Rows
        this.selectedRows = [...new Set([...this.allSelectedRows.map(({ id }) => id)])];
        // this.selectedRows = this.allSelectedRows;
        console.log("handleSearch-2-selectedRows", this.selectedRows);
    }

    // General Handler for simple Inputs
    handleChange(event) {
        this[event.target.name] = event.detail.value;
    }

    // Method to show dynamic popups for various events
    // Later, we can implement the Loading Functiontionality into the toast, because they can be triggered together.
    showToastEvent(title, message, variant, mode) {
        const event = new ShowToastEvent({
            title,
            message,
            variant,
            mode
        });
        this.dispatchEvent(event);
    }

    showError(title, message) {
        this.showToastEvent(title, message, "error", "sticky");
    }

    // Simple Function to Toggle the State of Loading
    loadingState(isLoading) {
        this.isLoading = isLoading;
        this.showTable = !isLoading;
        this.refreshButtonDisabled = isLoading;
    }
}
