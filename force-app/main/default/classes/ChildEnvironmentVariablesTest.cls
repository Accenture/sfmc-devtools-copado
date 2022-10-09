@IsTest
private class ChildEnvironmentVariablesTest {
    @TestSetup
    private static void setupData() {
        User standardUser = TestDataFactory.createStandardUser();
        insert standardUser;
        List<PermissionSetAssignment> permissions = TestDataFactory.createRequiredPermissions(
            standardUser.Id
        );
        insert permissions;

        System.runAs(standardUser) {
            createDefaultTestData();
        }
    }

    @IsTest
    private static void execute() {
        User standardUser = getStandardUser();
        System.runAs(standardUser) {
            copado__Environment__c parentEnvironment = [
                SELECT Id
                FROM copado__Environment__c
                WHERE Name = 'Parent EMEA'
                LIMIT 1
            ];
            List<copado__Environmental_Variable__c> environmentVariables = [
                SELECT Id
                FROM copado__Environmental_Variable__c
            ];

            String result = '';

            Test.startTest();
            result = ChildEnvironmentVariableController.getChildEnvironmentVariables(
                parentEnvironment.Id
            );
            Test.stopTest();

            System.assertNotEquals(null, result, 'Environment Variables JSON is null');

            List<ChildEnvironmentVariables.Environment> environments = (List<ChildEnvironmentVariables.Environment>) JSON.deserialize(
                result,
                List<ChildEnvironmentVariables.Environment>.class
            );
            System.assertEquals(3, environments.size(), 'Environment list size is not equal');
            System.assertEquals(
                3,
                environments[0].environmentVariables.size(),
                'Environment Variable list size is not equal'
            );

            Integer totalActualChildEnvironmentVariables =
                environments[0].environmentVariables.size() * environments.size();
            Integer totalExpectedChildEnvironmentVariables = environments.size() * 3;
            Integer totalEnvironmentVariables = totalExpectedChildEnvironmentVariables + 2;

            System.assertEquals(
                totalExpectedChildEnvironmentVariables,
                totalActualChildEnvironmentVariables,
                'Environment Variables list size is not equal for Child Environment'
            );
            System.assertEquals(
                totalEnvironmentVariables,
                environmentVariables.size(),
                'Environment Variables list size is not equal'
            );
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
        List<copado__Environment__c> childEnvironments = new List<copado__Environment__c>();
        List<copado__Environmental_Variable__c> environmentVariables = new List<copado__Environmental_Variable__c>();

        copado__Environment__c parentEnvironment = TestDataFactory.createTestEnvironment(
            'Parent EMEA',
            'Production/Developer'
        );
        insert parentEnvironment;

        copado__Environment__c childEnvironmentFrance = TestDataFactory.createTestEnvironment(
            'France',
            'Production/Developer'
        );
        childEnvironmentFrance.Parent_Environment__c = parentEnvironment.Id;
        childEnvironments.add(childEnvironmentFrance);

        copado__Environment__c childEnvironmentGermany = TestDataFactory.createTestEnvironment(
            'Germany',
            'Production/Developer'
        );
        childEnvironmentGermany.Parent_Environment__c = parentEnvironment.Id;
        childEnvironments.add(childEnvironmentGermany);

        copado__Environment__c childEnvironmentIreland = TestDataFactory.createTestEnvironment(
            'Ireland',
            'Production/Developer'
        );
        childEnvironmentIreland.Parent_Environment__c = parentEnvironment.Id;
        childEnvironments.add(childEnvironmentIreland);

        insert childEnvironments;

        for (copado__Environment__c eachEvironment : childEnvironments) {
            //Environment Variable creation
            for (Integer i = 1; i <= 3; i++) {
                environmentVariables.add(
                    TestDataFactory.createTestEnvironmentVariable(
                        eachEvironment.Id,
                        'envVariable_' + i,
                        'envVariableValue_' + i
                    )
                );
            }
        }

        for (Integer i = 1; i <= 2; i++) {
            environmentVariables.add(
                TestDataFactory.createTestEnvironmentVariable(
                    parentEnvironment.Id,
                    'envVariable_' + i,
                    'envVariableValue_' + i
                )
            );
        }

        insert environmentVariables;
    }
}
