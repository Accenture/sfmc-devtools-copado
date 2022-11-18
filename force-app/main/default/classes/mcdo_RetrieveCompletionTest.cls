@IsTest
public class mcdo_RetrieveCompletionTest {
	@TestSetup
    private static void setupData() {
        User standardUser = mcdo_TestDataFactory.createStandardUser();
        insert standardUser;
        
        List<PermissionSetAssignment> permissions = mcdo_TestDataFactory.createRequiredPermissions(
            standardUser.Id
        );
        insert permissions;	
        
        System.runAs(standardUser) {
            createDefaultTestData();
        }
    }
    
    @IsTest
    private static void executeTest() {        
        copado__JobExecution__c[] jobExecution = [
            SELECT Id
            FROM copado__JobExecution__c
        ];
        
        mcdo_RetrieveCompletion mcdo_rc = new mcdo_RetrieveCompletion();       
        Test.startTest();
        mcdo_rc.execute(jobExecution[0], 'this is a status');
        Test.stopTest();
        
        Event[] event = [
            SELECT WhoId, WhatId, StartDateTime
            FROM Event
        ];
        
        System.debug(event);
    }    
        
    private static void createDefaultTestData() {        
        copado__JobExecution__c jobExecution = new copado__JobExecution__c();
        insert jobExecution;
    }
}