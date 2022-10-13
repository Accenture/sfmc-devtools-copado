/*
 * This class is used by copado JobExecution and publish the PE copado__Event__e
 *
 *  Platform Event PE copado__Event__e
 */
global with sharing class mcdo_RetrieveCompletion implements copado.JobExecutionCallback {
    /*
    publish the copado Event
    */
    global void execute(copado__JobExecution__c job, String status) {
        copado__Event__e result = new copado__Event__e();
        result.copado__Topic_Uri__c = '/execution-completed/' + job.Id;
        result.copado__Payload__c = JSON.serialize(job);
        EventBus.publish(result);
    }
}