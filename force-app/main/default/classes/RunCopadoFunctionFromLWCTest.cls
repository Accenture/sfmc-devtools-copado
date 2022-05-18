@IsTest
private class RunCopadoFunctionFromLWCTest {
    @TestSetup
    static void makeData() {
        User standardUser = TestDataFactory.createStandardUser();
        insert standardUser;    
        List<PermissionSetAssignment> permissions = TestDataFactory.createRequiredPermissions(standardUser.Id);
        insert permissions;
        
        System.runAs(standardUser) {
            createDefaultTestData();
        }
    }

    @IsTest
    private static void executeRetrieveTest() {

        User standardUser = getStandardUser();
        System.runAs(standardUser) {
            // Setup
            copado__JobTemplate__c template = new copado__JobTemplate__c();
            template.Name = 'MC_Retrieve_Action';
            template.copado__Version__c = 1;
            template.copado__VolumeOptions__c = '[{ "name": "volumeSize", "value": "1" }, { "name": "volumeTTL", "value": "1440" },{ "name": "volumeEnabled", "value": "true" }]';
            insert template;

            copado__JobStep__c step1 = new copado__JobStep__c(Name = 'step1', copado__JobTemplate__c = template.Id, copado__Type__c = 'Manual');
            copado__JobStep__c step2 = new copado__JobStep__c(Name = 'step2', copado__JobTemplate__c = template.Id, copado__Type__c = 'Manual');
            insert new List<SObject>{ step1, step2 };

            copado__User_Story__c userStory = [SELECT Id FROM copado__User_Story__c LIMIT 1];

            // Exercise
            String result = RunCopadoFunctionFromLWC.executeRetrieve(userStory.Id);

            //Verify
            System.assertNotEquals(null, result, 'Result should not be null');

        }
    }

    @IsTest
    private static void getMetadataFromEnvironmentTest() {

        User standardUser = getStandardUser();
        System.runAs(standardUser) {
            // Setup
            copado__User_Story__c userStory = [SELECT Id FROM copado__User_Story__c LIMIT 1];

            // Exercise
            String result = RunCopadoFunctionFromLWC.getMetadataFromEnvironment(userStory.Id);

            //Verify
            System.assertNotEquals(null, result, 'Content data should not be null');

        }
    }
    
    private static User getStandardUser() {
        User standardUser = [
            SELECT Id
            FROM User
            WHERE ProfileId IN (SELECT Id FROM Profile WHERE Name = 'Standard User')
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        return standardUser;
    }

    private static void createDefaultTestData() {
        copado__Deployment_Flow__c pipeline = TestDataFactory.createDeploymentFlow('Test Pipeline', true, null, true);
        insert pipeline;

        copado__Environment__c environment = TestDataFactory.createTestEnvironment('dev1', 'Production/Developer');
        insert environment;

        copado__Project__c project = TestDataFactory.createTestProject(pipeline.Id);
        insert project;

        copado__User_Story__c userStory = TestDataFactory.createUserStory('Test Enhancement', 'Draft', null, project.Id, environment.Id);
        insert userStory;
        
        ContentVersion file = TestDataFactory.createFile('mcmetadata.json');
        insert file;

        ContentDocumentLink fileLink = TestDataFactory.createFileLink(file.Id, environment.Id);
        insert fileLink;
    }
}