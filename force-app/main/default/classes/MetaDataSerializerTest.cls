@IsTest
public class MetaDataSerializerTest {    
    @IsTest
    private static void parseTest() {       
        Test.startTest();
        List<MetaDataSerializer> metaDataSerializerList = MetaDataSerializer.parse('[{"name":"Value1", "value": {"name": "someName", "key": "someKey", "t": "someT", "cd": "someCd", "ld": "someLd"}}]');
        Test.stopTest();
        System.debug(metaDataSerializerList);
        //Verify
        System.assertEquals('Value1', metaDataSerializerList[0].name, 'metaDataSerializerList[0].name is not what it is supposed to be');
        System.assertEquals('someKey', metaDataSerializerList[0].value.key, 'metaDataSerializerList[0].value.key is not what it is supposed to be');
    }    
}