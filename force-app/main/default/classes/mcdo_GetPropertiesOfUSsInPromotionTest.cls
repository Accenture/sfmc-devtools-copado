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
        
        mcdo_GetPropertiesOfUSsInPromotion mcdo_gpousip = new mcdo_GetPropertiesOfUSsInPromotion();       
        Test.startTest();
        String result = mcdo_gpousip.execute(jobStep[0].Id);
        Test.stopTest();
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
    }    
    
    private static void createDefaultTestData() {
        
        // copado__System_Property__c[] systemProperty = [
        //     SELECT copado__ParentId__c
        //     FROM copado__System_Property__c
        // ];
        // System.debug(systemProperty);
        // System.debug(systemProperty[0]);
        // System.debug(systemProperty[0].copado__ParentId__c);
        
        copado__JobTemplate__c template = new copado__JobTemplate__c();
            template.Name = 'MC_Retrieve_Action';
            template.copado__Version__c = 1;
            template.copado__VolumeOptions__c = '[{ "name": "volumeSize", "value": "1" }, { "name": "volumeTTL", "value": "1440" },{ "name": "volumeEnabled", "value": "true" }]';
        insert template;
        
        copado__JobStep__c jobStep1 = new copado__JobStep__c(Name = 'stepWithoutAPromotion',
                copado__JobTemplate__c = template.Id,
                copado__Type__c = 'Manual');
        insert jobStep1;
             
        copado__Promotion__c promotion = new copado__Promotion__c();
        insert promotion;
        
        copado__JobExecution__c jobExecution = new copado__JobExecution__c(copado__Promotion__c=promotion.id);
        insert jobExecution;
        
        copado__JobStep__c jobStep2 = new copado__JobStep__c(Name = 'stepWithAPromotion',
                copado__JobTemplate__c = template.Id,
                copado__Type__c = 'Manual',
	 	        copado__JobExecution__c=jobExecution.Id);
        insert jobStep2;
    }
}