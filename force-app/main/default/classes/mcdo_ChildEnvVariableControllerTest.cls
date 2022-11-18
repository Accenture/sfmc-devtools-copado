@IsTest
public class mcdo_ChildEnvVariableControllerTest {
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
    private static void getmcdo_ChildEnvironmentVariablesTest() {        
        copado__Environment__c[] env = [
            SELECT id
            FROM copado__Environment__c
        ];
               
        Test.startTest();
        String result = mcdo_ChildEnvironmentVariableController.getmcdo_ChildEnvironmentVariables(env[0].id);
        Test.stopTest();
        
        System.debug(result);
        
        // because we are using an blank environment, it is supposed to return '';
        System.assertEquals('[]', result, 'result of mcdo_ChildEnvironmentVariableController.getmcdo_ChildEnvironmentVariables is not what it\'s supposed to be.');
    }    
        
    private static void createDefaultTestData() {        
        copado__Environment__c env = new copado__Environment__c();
        insert env;
    }
}