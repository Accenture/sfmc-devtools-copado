@IsTest
public class mcdo_GetPropertiesOfUSsInPromotionTest {
	@TestSetup
    private static void setupData() {
        User standardUser = mcdo_TestDataFactory.createStandardUser();
        insert standardUser;
        
        List<PermissionSetAssignment> permissions = mcdo_TestDataFactory.createRequiredPermissions(
            standardUser.Id
        );
        insert permissions;	
        
        System.runAs(standardUser) {
            mcdo_TestDataFactory.assignLicense(standardUser.Id); // this will assign the necessary licences to that user Id.
            createDefaultTestData();
        }
    }
    
    @IsTest
    private static void executeEmptyPromotionTest() {        
        copado__JobStep__c[] jobStep = [
            SELECT Id
            FROM copado__JobStep__c
            WHERE Name = 'stepWithoutAPromotion'
        ];
        Boolean wasExceptionThrown = false;
        mcdo_GetPropertiesOfUSsInPromotion mcdo_gpousip = new mcdo_GetPropertiesOfUSsInPromotion();       
        Test.startTest();
        try{
            String result = mcdo_gpousip.execute(jobStep[0].Id);
        }catch(Exception er){
            wasExceptionThrown = true;
        }
        Test.stopTest();
        //Assert that an exception was thrown
        System.assert(wasExceptionThrown, 'An Exception was not thrown');
    }    
    
    @IsTest
    private static void executeTest() { 
        copado__JobStep__c[] jobStep = [
            SELECT Id
            FROM copado__JobStep__c
            WHERE Name = 'stepWithAPromotion'
        ];    
        mcdo_GetPropertiesOfUSsInPromotion mcdo_gpousip = new mcdo_GetPropertiesOfUSsInPromotion();
        Test.startTest();
        String result = mcdo_gpousip.execute(jobStep[0].Id);
        Test.stopTest();
        System.assertEquals('[]', result);
    }    
    
    private static void createDefaultTestData() {

        copado__JobTemplate__c template = new copado__JobTemplate__c();
            template.Name = 'MC_Retrieve_Action';
            template.copado__Version__c = 1;
            template.copado__VolumeOptions__c = '[{ "name": "volumeSize", "value": "1" }, { "name": "volumeTTL", "value": "1440" },{ "name": "volumeEnabled", "value": "true" }]';
        insert template;
        
        copado__JobStep__c jobStep1 = new copado__JobStep__c(Name = 'stepWithoutAPromotion',
                copado__JobTemplate__c = template.Id,
                copado__Type__c = 'Manual');
        insert jobStep1;
             
        copado__Deployment_Flow__c pipeline = new copado__Deployment_Flow__c(copado__Active__c=true);
        insert pipeline;
        
        copado__Project__c project = new copado__Project__c(copado__Deployment_Flow__c=pipeline.id);
        insert project;
        
        copado__Promotion__c promotion = new copado__Promotion__c(copado__Project__c = project.id);
        insert promotion;
        
        copado__User_Story__c userStory = new copado__User_Story__c(copado__Project__c=project.id);
        insert userStory;
        
        copado__Promoted_User_Story__c promotedUserStory = new copado__Promoted_User_Story__c(copado__Promotion__c=promotion.id, copado__User_Story__c=userStory.id);
        insert promotedUserStory;
        
        copado__JobExecution__c jobExecution = new copado__JobExecution__c(copado__Promotion__c=promotion.id);
        insert jobExecution;
        
        copado__JobStep__c jobStep2 = new copado__JobStep__c(Name = 'stepWithAPromotion',
                copado__JobTemplate__c = template.Id,
                copado__Type__c = 'Manual',
	 	        copado__JobExecution__c=jobExecution.Id);
        insert jobStep2;
    }
}