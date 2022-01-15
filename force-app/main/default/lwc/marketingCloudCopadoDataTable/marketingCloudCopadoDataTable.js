/**
 *
 * This Lightning Web Component contains a table that displays deployable Marketing Cloud metaetdata
 * that can be selected to be commited from one Business Unit to another.
 * Commited metadata will be included in the version control system and then deployed.
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
import { LightningElement, api, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import {
  subscribe as subscribeEmp,
  unsubscribe as unsubscribeEmp,
  onError as onEmpError
} from "lightning/empApi";

// Apex Methods for retrieving and commiting metadata (And Communication with the Copado Package)
import ExecuteRetrieveFromCopado from "@salesforce/apex/RunCopadoFunctionFromLWC.executeRetrieve";
import getMetadataFromEnvironment from "@salesforce/apex/RunCopadoFunctionFromLWC.getMetadataFromEnvironment";

// Apex functions to retrieve Recorddata from LWC

// "Commit Changes" Page Tab related
import COMMIT_PAGE_COMMUNICATION_CHANNEL from "@salesforce/messageChannel/copado__CommitPageCommunication__c";
import {
  MessageContext,
  subscribe as subscribeMessageService,
  publish as publishMessageService
} from "lightning/messageService";

import { CurrentPageReference } from "lightning/navigation";

export default class MarketingCloudCopadoDataTable extends LightningElement {
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
        console.log("userStoryId", userStoryId);
        this.userStoryId = userStoryId;
      }
    } catch (err) {
      console.error(`${err.name}: ${err.message}: `, err);
      this.showToastEvent(
        `${err.name}: An Error occured while reading the Record ID from CurrentPageReference inside LWC`,
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
    { label: "Name", fieldName: "n", type: "string", sortable: true },
    { label: "Key", fieldName: "k", type: "string", sortable: true },
    { label: "Type", fieldName: "t", type: "string", sortable: true },
    {
      label: "Last Modified By ID",
      fieldName: "lb",
      type: "string",
      sortable: true
    },
    {
      label: "Last Modified Date",
      fieldName: "ld",
      type: "date",
      sortable: true
    },
    { label: "Created By", fieldName: "cb", type: "string", sortable: true },
    { label: "Created Date", fieldName: "cd", type: "date", sortable: true }
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
  channelName = "/event/copado__MC_Result__e";

  _subscribeToMessageService() {
    subscribeMessageService(
      this._context,
      COMMIT_PAGE_COMMUNICATION_CHANNEL,
      (message) => this._handleCommitPageCommunicationMessage(message)
    );
  }

  async _handleCommitPageCommunicationMessage(message) {
    console.log("Async _handleCommitPageCommunicationMessage starts now");
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
          /* await this._handleChangesMessage(message); */
          break;
        default:
      }
    } catch (err) {
      console.error(`${err.name}: ${err.message}: `, err);
      this.showToastEvent(
        `${err.name}: An Error occured while handling the Commit Page Communication Message:`,
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
    const selectedRows = this.template
      .querySelector("lightning-datatable")
      .getSelectedRows();
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
    publishMessageService(
      this._context,
      COMMIT_PAGE_COMMUNICATION_CHANNEL,
      payload
    );
  }

  /*     async _handleChangesMessage(message) {
        console.log('_handleChangesMessage runs now');
        const metadatas = message.value;
        const metadataRows = prepareRows(this.recordId, metadatas, this.keyField);
    } */

  // Suscribes initially to Message Service, Register the Error Listener for the Emp Api
  // Get Metadata from environment, Deactivate the Loading State
  connectedCallback() {
    try {
      this._subscribeToMessageService();
    } catch (err) {
      console.error(`${err.name}: ${err.message}: `, err);
      this.showToastEvent(
        `${err.name}: An Error occured while subscribing to the message service:`,
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
      getMetadataFromEnvironment(this.userStoryId).then((result) => {
        const parsedResult = JSON.parse(result);
        this.data = parsedResult;
        this.visibleData = parsedResult;
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

  // Function to get the newest Commitable Metadata, and save it in the environment
  retrieve() {
    // Activate Loading State
    this.loadingState(true);

    //recordId = ((new URL(window.location.href)).searchParams.get("copado__recordId"));
    const userStoryId = this.userStoryId;
    console.log("userStoryId: ", userStoryId);

    // Set a reference to this, so that it can be called inside the messageCallback
    const self = this;
    console.log(self);
    /*
        const userStoryName = this.userStoryName;               // Will be passed into the Copado Function Script
        const envId = this.envId;                               // Will be passed into the Copado Function Script
        */

    console.log("Passing the following parameter into the Retrieve function:");
    console.log("userStoryId: ", userStoryId);

    ExecuteRetrieveFromCopado({
      userStoryId
    })
      .then((jobExecutionId) => {
        /* TODO: Make sure to only return the correct result... */
        console.log("This is the Job Execution ID: ", jobExecutionId);
        // The response tells whether the function has finished and was successful or not
        const messageCallback = function (response) {
          const isFinished = response.data.payload.copado__IsFinished__c;
          const isSuccess = response.data.payload.copado__IsSuccess__c;
          const progressStatus =
            response.data.payload.copado__Progress_Status__c;

          if (isFinished === false) {
            self.progressStatus = progressStatus;
          } else if (isFinished === true) {
            try {
              unsubscribeEmp(self.empSubscription, (response) => {
                console.log("unsubscribe() response: ", response);
              });
            } catch (err) {
              console.error("Error while unsubscribing from Emp API: ", err);
              self.showToastEvent(
                `${err.name}: An error occurred while unsubscribing from Emp API`,
                `${err.message}`,
                "error",
                "sticky"
              );
            }

            if (isSuccess === true) {
              try {
                getMetadataFromEnvironment().then((result) => {
                  console.log("Metadata fetched from Environment: ", result);
                  const parsedResult = JSON.parse(result);
                  self.data = parsedResult;
                  self.visibleData = parsedResult;
                });
              } catch (err) {
                console.error(
                  "Error fetching the Metadata from File after the Retrievement: ",
                  err
                );
                self.showToastEvent(
                  `${err.name}: Error fetching the Metadata from File after the Retrievement`,
                  `${err.message}`,
                  "error",
                  "sticky"
                );
              }
            } else if (isSuccess === false) {
              console.log(
                `Running The Retrieve Function Failed! 
                            Please Check the Job Execution with the ID "${jobExecutionId}" 
                            in the Execution History of the Retrieve Function.`
              );
              self.showToastEvent(
                "Executing Retrieve failed!",
                `Please Check the Job Execution with the ID "${jobExecutionId}"
                            in the Execution History of the Copado Retrieve Function.`,
                "error",
                "sticky"
              );
            }
            self.loadingState(false);
          }
        };

        // Invoke subscribe method of empApi. Pass reference to messageCallback
        try {
          subscribeEmp(this.channelName, -1, messageCallback).then(
            (response) => {
              // Response contains the subscription information on subscribe call
              console.log("Subscribed to ", response.channel);
              this.empSubscription = response;
            }
          );
        } catch (err) {
          console.error("Error while subscribing to Emp API: ", err);
          self.showToastEvent(
            `${err.name}: An error occurred while subscribing to Emp API`,
            `${err.message}`,
            "error",
            "sticky"
          );
        }
      })
      .catch((err) => {
        console.error("Error while running Retrieve: ", err);
        this.showToastEvent(
          `${err.name}: An error occurred during the execution of the retrieve`,
          `${err.message}`,
          "error",
          "sticky"
        );
        this.loadingState(false);

        // if previously Rows have been selected, set them as selected again
        if (self.selectedRows.length > 0) {
          self.selectedRows = selectedMetadata.map(({ k }) => k);
        }
      });
  }

  sortBy(field, reverse, primer) {
    const key = primer
      ? function (x) {
          return primer(x[field]);
        }
      : function (x) {
          return x[field];
        };

    return function (a, b) {
      a = key(a);
      b = key(b);
      return reverse * ((a > b) - (b > a));
    };
  }

  onHandleSort(event) {
    const { fieldName: sortedBy, sortDirection } = event.detail;
    const cloneData = [...this.visibleData];

    cloneData.sort(this.sortBy(sortedBy, sortDirection === "asc" ? 1 : -1));
    this.visibleData = cloneData;
    this.sortDirection = sortDirection;
    this.sortedBy = sortedBy;
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

  /**
   * Function that handles the search input field and the selectedRows of the table regarding the changing visible Data
   * TODO: It's not possible to remove a row, when the dataset is reduced (search)
   */
  handleSearch(event) {
    const visibleSelectedRowsBefore = this.template
      .querySelector("lightning-datatable")
      .getSelectedRows();

    let ar = [
      ...new Set([...this.allSelectedRows, ...visibleSelectedRowsBefore])
    ];
    this.allSelectedRows = ar;

    // Filter Rows
    const regex = new RegExp(event.target.value, "gi");
    this.visibleData = this.data.filter((row) => regex.test(row.n));

    // Set selected Rows
    this.selectedRows = this.allSelectedRows.map(({ k }) => k);
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

  // Simple Function to Toggle the State of Loading
  loadingState(isLoading) {
    this.isLoading = isLoading;
    this.showTable = !isLoading;
    this.refreshButtonDisabled = isLoading;
  }
}
