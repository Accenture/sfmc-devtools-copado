import { LightningElement, api } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { NavigationMixin } from "lightning/navigation";
import getmcdo_ChildEnvironmentVariables from "@salesforce/apex/mcdo_ChildEnvironmentVariableController.getmcdo_ChildEnvironmentVariables";

export default class mcdo_ChildEnvironmentVariables extends NavigationMixin(LightningElement) {
    @api recordId;
    @api items = [];
    header = "Child Environments & Variables";

    get hasItems() {
        const result = this.items && this.items.length ? true : false;
        return result;
    }

    connectedCallback() {
        this._getVariables();
    }

    handleSelect(event) {
        const environmentId = event.detail.name;
        if (environmentId) {
            this._navigateToPage({ Id: environmentId }, "view");
        }
    }

    // PRIVATE

    async _getVariables() {
        try {
            const result = await getmcdo_ChildEnvironmentVariables({ environmentId: this.recordId });
            if (result) {
                this._processItems(JSON.parse(result));
                this.header = this.header + " (" + this.items.length + ")";
            }
        } catch (error) {
            const message = error.message ? error.message : error;
            this.showToastMessage("Error: ", message, "error", "dismissable");
        }
    }

    _processItems(allRows) {
        const result = allRows.map((environment) => {
            const eachItem = this._prepareItem(environment.name, environment.id, "");
            const environmentVariables = [];
            environment.environmentVariables.forEach((environmentVariable) => {
                environmentVariables.push(
                    this._prepareItem(
                        environmentVariable.name + ": " + environmentVariable.value,
                        environmentVariable.id,
                        ""
                    )
                );
            });
            eachItem.items = environmentVariables;
            return eachItem;
        });
        this.items = result;
    }

    _prepareItem(label, name, metatext) {
        const result = {
            label: label,
            name: name,
            metatext: metatext,
            expanded: false,
            items: []
        };
        return result;
    }

    _navigateToPage(row, actionName) {
        this[NavigationMixin.GenerateUrl]({
            type: "standard__recordPage",
            attributes: {
                recordId: row.Id,
                actionName: actionName
            }
        }).then((url) => {
            window.open(url, "_blank");
        });
    }

    showToastMessage(title, message, variant, mode) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: mode
        });
        this.dispatchEvent(evt);
    }
}