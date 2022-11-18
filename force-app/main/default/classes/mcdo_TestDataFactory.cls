/**
 * Utility class for Apex Unit tests
 * @Author Nishant Bansal
 * @version 1.0
 */
@SuppressWarnings('PMD')
@IsTest
public with sharing class mcdo_TestDataFactory {
    /**
     * Create Sample copado__Git_Repository__c and return it's instance
     */
    public static copado__Git_Repository__c createGitRepository() {
        copado__Git_Repository__c repo = new copado__Git_Repository__c();
        repo.Name = 'test repo';
        return repo;
    }

    /**
     * Create Sample copado__Git_Repository__c and return it's instance
     */
    public static copado__Deployment_Flow__c createDeploymentFlow(
        String name,
        Boolean isActive,
        String gitRepositoryId,
        Boolean enableDX
    ) {
        // NOPMD : Supressing rule to avoid large refactor.
        copado__Deployment_Flow__c deploymentFlow = new copado__Deployment_Flow__c();
        deploymentFlow.Name = name;
        deploymentFlow.copado__Active__c = isActive;
        deploymentFlow.copado__Git_Repository__c = gitRepositoryId;
        deploymentFlow.copado__Enable_Copado_DX__c = enableDX;
        deploymentFlow.copado__Main_Branch__c = 'master';
        return deploymentFlow;
    }

    /**
     * Create Sample copado__Git_Repository__c and return it's instance
     */
    public static copado__Deployment_Flow_Step__c createDeploymentFlowStep( // NOPMD : Supressing rule to avoid large refactor.
        String sourceEnvironmentId,
        String destinationEnvironmentId,
        String deploymentFlowId,
        String scratchOrgDestination
    ) {
        copado__Deployment_Flow_Step__c deploymentFlowStep = new copado__Deployment_Flow_Step__c();
        deploymentFlowStep.copado__Source_Environment__c = sourceEnvironmentId;
        deploymentFlowStep.copado__Destination_Environment__c = destinationEnvironmentId;
        deploymentFlowStep.copado__Deployment_Flow__c = deploymentFlowId;
        deploymentFlowStep.copado__Enable_as_Scratch_Org_Destination__c = scratchOrgDestination;

        return deploymentFlowStep;
    }

    /**
     * Create Sample copado__Environment__c and return it's instance
     */
    public static copado__Environment__c createTestEnvironment(String name, String type) {
        copado__Environment__c environment = new copado__Environment__c();
        environment.copado__Type__c = type;
        environment.Name = name;
        environment.copado__Platform__c = 'Marketing Cloud';
        return environment;
    }

    /**
     * Create Sample copado__Environmental_Variable__c and return it's instance
     */
    public static copado__Environmental_Variable__c createTestEnvironmentVariable(
        String environmentId,
        String name,
        String value
    ) {
        copado__Environmental_Variable__c environmentVariable = new copado__Environmental_Variable__c();
        environmentVariable.Name = name;
        environmentVariable.copado__Value__c = value;
        environmentVariable.copado__Environment__c = environmentId;
        return environmentVariable;
    }

    /**
     * Create Sample copado__Project__c and return it's instance
     */
    public static copado__Project__c createTestProject(String pipelineId) {
        copado__Project__c proj = new copado__Project__c(Name = 'Test Project Name');
        proj.copado__Status__c = 'Draft';
        proj.copado__Description__c = 'My Test description';
        proj.copado__Start_Date__c = System.today();
        proj.copado__Deployment_Flow__c = pipelineId;
        return proj;
    }

    /**
     * Create Sample copado__User_Story__c and return it's instance
     */
    public static copado__User_Story__c createUserStory( // NOPMD : Supressing rule to avoid large refactor.
        String userStoryTitle,
        String status,
        String sprintId,
        String projectId,
        String environmentId
    ) {
        copado__User_Story__c userStory = new copado__User_Story__c();
        userStory.copado__User_Story_Title__c = userStoryTitle;
        userStory.copado__Status__c = status;
        userStory.copado__Sprint__c = sprintId;
        userStory.copado__Project__c = projectId;
        userStory.copado__Environment__c = environmentId;
        return userStory;
    }

    /**
     * Create Sample ContentVersion and return it's instance
     */
    public static ContentVersion createFile(String title) {
        ContentVersion contentVersionRecord = new ContentVersion();
        contentVersionRecord.ContentLocation = 'S'; // 'S' = a Salesforce File
        contentVersionRecord.VersionData = Blob.valueOf('sample content');
        contentVersionRecord.Title = title;
        contentVersionRecord.PathOnClient = title;
        return contentVersionRecord;
    }

    /**
     * Create Sample ContentDocumentLink and return it's instance
     */
    public static ContentDocumentLink createFileLink(
        String contentVersionRecordId,
        String entityId
    ) {
        Id contentDocumentId = [
            SELECT ContentDocumentId
            FROM ContentVersion
            WHERE Id = :contentVersionRecordId
        ]
        .ContentDocumentId;
        ContentDocumentLink contentDocumentLinkRecord = new ContentDocumentLink();
        contentDocumentLinkRecord.LinkedEntityId = entityId;
        contentDocumentLinkRecord.ContentDocumentId = contentDocumentId;
        contentDocumentLinkRecord.shareType = 'V';
        return contentDocumentLinkRecord;
    }

    /**
     * This method creates a User with the Standard User profile for testing purposes - with username: test.username@testdomain.com
     */
    public static User createStandardUser() {
        return createUser('LastName', 'test2@test2.com', 'test.username@testdomain.com', 'alias2');
    }

    /**
     * This method creates a User with the Standard User profile for testing purposes - with username: invalidtest.username@testdomain.com
     */
    public static User createInvalidUser() {
        return createUser(
            'LastName',
            'test1@test1.com',
            'invalidtest.username@testdomain.com',
            'alias1'
        );
    }

    /**
     * This method to create a user for testing purposes.
     */
    public static User createUser(String lastName, String email, String username, String alias) {
        User standardUser = new User();
        standardUser.ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User'].Id;
        standardUser.LastName = lastName;
        standardUser.Email = email;
        standardUser.Username = username;
        standardUser.Alias = alias;
        standardUser.TimeZoneSidKey = 'America/Los_Angeles';
        standardUser.EmailEncodingKey = 'UTF-8';
        standardUser.LanguageLocaleKey = 'en_US';
        standardUser.LocaleSidKey = 'en_US';
        return standardUser;
    }

    /**
     * This method assigns the Copado_ALM_User permission to a selected user for testing purposes.
     */
    public static List<PermissionSetAssignment> createPermissions(
        Id userId,
        Set<String> permissionSetNames
    ) {
        List<PermissionSet> permissionSets = [
            SELECT Id
            FROM PermissionSet
            WHERE Name IN :permissionSetNames
        ];
        List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
        for (PermissionSet thisPermission : permissionSets) {
            PermissionSetAssignment assignment = new PermissionSetAssignment();
            assignment.PermissionSetId = thisPermission.Id;
            assignment.AssigneeId = userId;
            assignments.add(assignment);
        }
        return assignments;
    }

    /**
     * This method assigns the All required permission to a selected user for testing purposes.
     */
    public static List<PermissionSetAssignment> createRequiredPermissions(Id userId) {
        List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
        assignments.addAll(
            createPermissions(
                userId,
                new Set<String>{ 'Copado_Job_Engine', 'Copado_User', 'Copado_Functions' }
            )
        );
        return assignments;
    }
    
     /**
     * This method assigns the necessary licenses to a user in order to let the user update promotions and so on
     */
    public static void assignLicense(Id userId) {
        copado.GlobalAPI copadoGlobalAPI = new copado.GlobalAPI();
        copado.GlobalAPI.UserLicense userLicense = new copado.GlobalAPI.UserLicense();
        userLicense.isCCMEnabled = true;
        userLicense.isCopadoEnabled = true;
        userLicense.userId = userId;
        copadoGlobalAPI.upsertCopadoLicense(userLicense);
    }
}