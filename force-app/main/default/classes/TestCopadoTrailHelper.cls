@isTest
public class TestCopadoTrailHelper {

    static testMethod void testCacheCleanup() {
        copado__Org__c testOrg = new copado__Org__c(Name='Test');
        insert testOrg;
        
        List<Attachment> atts = new List<Attachment>(); 
        String b1 = '[{"t":"InstalledPackage", "n":"mule",               "b":"", "d":"", "cb":"", "cd":""},'+
                     '{"t":"InstalledPackage", "n":"copado",             "b":"", "d":"", "cb":"", "cd":""},'+
                     '{"t":"CustomObject",     "n":"copado__Project__c", "b":"", "d":"", "cb":"", "cd":""}]';
        Attachment a1 = new Attachment(Name='MetaData', Body=Blob.valueOf(b1), ParentId=testOrg.Id);
        atts.add(a1);
        
        String b2 = '[{"t":"InstalledPackage", "n":"mule",                  "b":"", "d":"", "cb":"", "cd":""},'+
                     '{"t":"ApexClass",        "n":"TestCopadoTrailHelper", "b":"", "d":"", "cb":"", "cd":""},'+
                     '{"t":"ApexClass",        "n":"CopadoTrailHelper",     "b":"", "d":"", "cb":"", "cd":""}]';
        Attachment a2 = new Attachment(Name='MetaData', Body=Blob.valueOf(b2), ParentId=testOrg.Id);
        atts.add(a2);
        insert atts;
        system.debug('>>> Atts: '+atts);
        
        Test.startTest();
        CopadoTrailHelper.cacheFile cf = new CopadoTrailHelper.cacheFile('ApexClass', 'CopadoTrailHelper','','','','');
        system.assertEquals('ApexClass', cf.t);
        try{
        	CopadoTrailHelper.trimMetadataCache('copado', 'Test');    
        }
        catch(Exception e){
            system.debug('>>>>>>>>>> Error: '+e);
        }
        
        Test.stopTest();
        
        List<Attachment> results = [select Id, Body from Attachment where ParentId=:testOrg.Id];
        
        for(Attachment a : results) {
            List<CopadoTrailHelper.cacheFile> theCache = new List<CopadoTrailHelper.cacheFile>();
            theCache = (List<CopadoTrailHelper.cacheFile>) JSON.deserialize(a.Body.toString(), List<CopadoTrailHelper.cacheFile>.class);
            system.debug('>>> List: '+theCache);
            system.debug('>>> Size: '+theCache.size());
            system.assertEquals(1, theCache.size());
        }
    }
}