import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getChildEnvironmentVariables from '@salesforce/apex/ChildEnvironmentVariableController.getChildEnvironmentVariables';

export default class ChildEnvironmentVariables extends LightningElement {
    @api recordId;
    @api items = [];
    header = 'Child Environments & Variables';

    get hasItems() {
        const result = this.items && this.items.length ? true : false;
        return result;
    }

    connectedCallback() {
        this._getVariables();
    }

    // PRIVATE

    async _getVariables() {
        try {
            const result = await getChildEnvironmentVariables({ environmentId: this.recordId });
            if (result) {
                this._processItems(JSON.parse(result));
                this.header = this.header + ' (' + this.items.length + ')';
            }
        } catch (error) {
            const message = error.message ? error.message : error;
            this.showToastMessage('Error: ', message, 'error', 'dismissable');
        }
    }

    _processItems(allRows) {
        const result = [];
        let counter = 0;
        allRows.forEach(row => {
            counter++;
            const eachItem = this._prepareItem(row.environmentName, ''+counter, '');

            const envVariables = [];
            row.environmentVariables.forEach(eachEnvVariable => {
                counter++;
                envVariables.push(this._prepareItem(eachEnvVariable.name, ''+counter, eachEnvVariable.value));
            });
            eachItem.items = envVariables;
            result.push(eachItem);
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