/**
 * Created by master on 07.02.16.
 */
define(["entities","EntityManager"],function(entities,EntityManager){

    function test() {
        //testbidirLocal();
        //testCRUD();
        //testCRUD2();
        testCRUD3();
        testCRUD4();
    }

    function testbidirLocal() {

        console.log("test");

        var e = new entities.TestEntity();
        // test single-values attribute
        var tag = new entities.Tag("test");
        tag._id = 1;
        e.attr = tag;
        e.attrManager.loaded = true;
        console.log("e.attr: " + e.attr);
        console.log("e.attrManager: " + e.attrManager);
        console.log("identity: " + (e.attr === e.attrManager.entity()));

        // test multi-valued attribute
        e.attrsManager.loaded = true;
        var note1 = new entities.Note("lorem ipsum");
        note1._id = 2;
        note1.lorem = "ipsum";

        e.addAttr(note1);
        console.log("e.attrs: " + e.attrs);
        console.log("e.attrsManager: " + e.attrsManager);
        console.log("identity: " + (e.attrs[0] === e.attrsManager.entities()[0]));
        // add a new element using one of the dynamically added accessors
        var note2 = new entities.Note("lirem opsum");
        note2._id = 3;
        note2.dolor = "sit amet";
        e.addAttr(note2);
        e.lorem = "lorem";
        e.ipsum = "ipsum";

        console.log("getAttr(): " + e.getAttr(0));

        console.log("pojo with entities (before push): " + JSON.stringify(e.toPojo(true)));
        console.log("pojo without entities (before push): " + JSON.stringify(e.toPojo(false)));

        var note3 = new entities.Note("elit consectetur");
        note3._id = 4;

        // TODO: it seems that for some reason, directly pushing does not work?
        // as e.attrs returns the array itself without any reference to the managed entities array it is clear that this is the issue!!!
        // we could check consistency at some moment...
        e.attrs.push(note3);
        console.log("pojo with entities (after push): " + JSON.stringify(e.toPojo(true)));
        console.log("pojo without entities (after push): " + JSON.stringify(e.toPojo(false)));

        console.log("************** CHECK INVERSION **************");

        var tag1 = new entities.Tag("tag1");
        tag1._id = 5;
        var tag2 = new entities.Tag("tag2");
        tag2._id = 6;

        note1.addTag(tag1);
        note2.addTag(tag1);
        note2.addTag(tag2);
        note3.addTag(tag1);
        note3.addTag(tag2);

        var note4 = new entities.Note("adipiscing");
        note4._id = 7;
        var tag3 = new entities.Tag("lipsum amet");
        tag3._id = 8;

        console.log("note1: " + JSON.stringify(note1.toPojo()));
        console.log("note2: " + JSON.stringify(note2.toPojo()));
        console.log("note3: " + JSON.stringify(note3.toPojo()));
        console.log("tag1: " + JSON.stringify(tag1.toPojo()));
        console.log("tag2: " + JSON.stringify(tag2.toPojo()));
        console.log("tag3: " + JSON.stringify(tag3.toPojo()));

        tag1.addContentItem(note4);
        note4.addTag(tag3);

        console.log("note1: " + JSON.stringify(note1.toPojo()));
        console.log("note2: " + JSON.stringify(note2.toPojo()));
        console.log("note3: " + JSON.stringify(note3.toPojo()));
        console.log("note4: " + JSON.stringify(note4.toPojo()));
        console.log("tag1: " + JSON.stringify(tag1.toPojo()));
        console.log("tag2: " + JSON.stringify(tag2.toPojo()));
        console.log("tag3: " + JSON.stringify(tag3.toPojo()));

        // test fromPojo
        var tagtest = new entities.Tag("test");
        console.log("tag1.contentItemsManager: " + (tag1["contentItemsManager"] ? true : false));
        console.log("tag2.contentItemsManager: " + (tag2.contentItemsManager ? true : false));
        console.log("tagtest.contentItemsManager: " + (tagtest["contentItemsManager"] ? true : false))

        var tagpojo = tag1.toPojo();
        tagtest.fromPojo(tagpojo);
        console.log("orig: " + JSON.stringify(tagpojo));
        console.log("copy: " + JSON.stringify(tagtest.toPojo()));

        // we test the crud operations

    }

    function testCRUD() {
        // first of all create two tags
        var tag1 = new entities.Tag("tag1");
        var tag2 = new entities.Tag("tag2");
        var tag3 = new entities.Tag("tag3");
        var note1 = new entities.Note("lorem ipsum");
        var note2 = new entities.Note("adispiscing elit");
        // first of all create the two tags
        EntityManager.em.create(tag1.getTypename(),tag1,function(createdtag){
            console.log("created tag: " + JSON.stringify(createdtag.toPojo()));

            console.log("created tag: identity tag1/createdtag: " + (tag1 === createdtag));
            EntityManager.em.create(tag1.getTypename(),tag2,function(createdtag2){
                console.log("created tag: " + JSON.stringify(createdtag2.toPojo()));
                EntityManager.em.create(tag1.getTypename(),tag3,function(createdtag3){
                    console.log("created tag: " + JSON.stringify(createdtag3.toPojo()));
                    // create a Note instance, add the two tags and run update+delete
                    EntityManager.em.readAll(note1.getTypename(),function(read1){
                        console.log("readAll: " + read1.length + ": " + JSON.stringify(read1));
                        console.log("note1 before create: " + JSON.stringify(note1.toPojo()));
                        EntityManager.em.create(note1.getTypename(),note1,function(created){
                            created.addTag(createdtag3);
                            created.addTag(createdtag);
                            created.addTag(createdtag2);
                            console.log("created note: " + JSON.stringify(created.toPojo()));
                            EntityManager.em.update(note1.getTypename(),created._id,created,function(updated){
                                var pojo =  updated.toPojo();
                                console.log("updated: " + JSON.stringify(pojo) + " with " + pojo.tags.length + " tags.");
                                // output and check whether bidirectionality works
                                console.log("identity tag1/createdtag: " + (tag1 === createdtag));
                                console.log("tag1.contentItems[0]: " + JSON.stringify(tag1.contentItems[0]) + ", identity tag1.contentItem/note1: " + (tag1.contentItems[0] === note1));
                                console.log("tag1: " + JSON.stringify(createdtag.toPojo()));
                                console.log("tag2: " + JSON.stringify(createdtag2.toPojo()));
                                console.log("tag3: " + JSON.stringify(createdtag3.toPojo()));
                                updated.tags.forEach(function(currenttag){
                                    console.log("note1 contains tag: " + JSON.stringify(currenttag.toPojo()));
                                });

                                /*
                                 EntityManager.em.read(note1.getTypename(),updated._id,function(read){
                                 console.log("read: " + read);
                                 EntityManager.em.delete(note1.getTypename(),read._id,function(deleted){
                                 console.log("deleted: " + deleted);
                                 // create another instance and run readAll
                                 EntityManager.em.create(note2.getTypename(),note2,function(created2){
                                 console.log("created note2: " + JSON.stringify(created.toPojo()));
                                 EntityManager.em.readAll(note2.getTypename(),function(read2){
                                 console.log("readAll: " + read2.length + ": " + JSON.stringify(read2));
                                 EntityManager.em.readAll(note2.getTypename(),function(read3){
                                 console.log("readAll: " + read3.length + ": " + JSON.stringify(read3));

                                 // we iterate over the tags of updated
                                 updated.tags.forEach(function(currenttag){
                                 console.log("note1 contains tag: " + JSON.stringify(currenttag.toPojo()));
                                 });

                                 });
                                 });
                                 });
                                 });
                                 });*/
                            });
                        });
                    });
                });
            });
        });
    }

    function testCRUD2() {

        var tag1 = new entities.Tag("tag1");
        var tag2 = new entities.Tag("tag2");
        var tag3 = new entities.Tag("tag3");
        var tag4 = new entities.Tag("tag4");
        var tag5 = new entities.Tag("tag5");

        var tags = [tag1,tag2,tag3, tag4, tag5];

        var note1 = new entities.Note("lorem ipsum");

        tag1.create(function(){
            tag2.create(function(){
                tag3.create(function(){
                    tag4.create(function(){
                        tag5.create(function(){
                            note1.addTag(tag1);
                            note1.addTag(tag2);
                            note1.addTag(tag3);
                            note1.create(function() {
                                console.log("created: " + JSON.stringify(note1.toPojo()));
                                // we add another tag and update note1
                                note1.addTag(tag4);
                                note1.update(function(){
                                    if (note1.tags.length == 0) {
                                        console.error("no tags specified on note1: " + JSON.stringify(note1.toPojo()));
                                    }
                                    else {
                                        for (var i = 0; i < note1.tags.length; i++) {
                                            console.info("found tag with id " + note1.tags[i]._id + ": " + JSON.stringify(note1.tags[i].toPojo()) + ", identity: " + (note1.tags[i] === tags[i]));
                                            console.info("identity of tag.contentItems[0]=note1: " + (tags[i].contentItems[0] === note1) + ", _id is: " + tags[i].contentItems[0]._id);
                                        }
                                    }
                                    entities.Note.read(note1._id,function(read) {
                                        console.info("Note.read(): identity read note1: " + (read === note1));
                                        entities.Note.readAll(function(read) {
                                            console.info("Note.readAll(): read: " + read.length);
                                            // we lookup the entity with the same id as note1
                                            var lookup;
                                            read.forEach(function(current){
                                                if (note1._id == current._id) {
                                                    lookup = current;
                                                }
                                            });
                                            if (lookup) {
                                                console.info("Note.readAll(): read: identity of looked up element " + JSON.stringify(lookup.toPojo()) + " with note1 (_id: " + note1._id + "): " + (lookup === note1));
                                            }
                                            else {
                                                console.error("Note.readAll(): note1 could not be found in output of readAll()!");
                                            }
                                            // once again...
                                            entities.Note.readAll(function(read) {
                                                console.info("Note.readAll(): read: " + read.length);
                                            });

                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

    }

    function testCRUD3() {

        var tag1 = new entities.Tag("tag1");
        var tag2 = new entities.Tag("tag2");
        var tag3 = new entities.Tag("tag3");
        var tag4 = new entities.Tag("tag4");
        var tag5 = new entities.Tag("tag5");

        var tags = [tag1,tag2,tag3, tag4, tag5];

        var note1 = new entities.Note("lorem ipsum");

        tag1.create(function(){
            tag2.create(function(){
                tag3.create(function(){
                    tag4.create(function(){
                        tag5.create(function(){
                            note1.addTag(tag1);
                            note1.addTag(tag2);
                            note1.addTag(tag3);
                            note1.addTag(tag4);
                            note1.addTag(tag5);

                            note1.removeTag(tag1);
                            console.info("before create: " + JSON.stringify(note1.toPojo()));
                            note1.create(function() {
                                console.info("after create: note1: " + JSON.stringify(note1.toPojo()));

                                // read out the tags
                                console.info("after create: tag2: " + JSON.stringify(tag2.toPojo()));

                                // we need to enforce loading of contentItems in tag2
                                tag2.contentItems.load(function(){
                                    console.info("identity of note1 with tag2.contentItems[0]: " + (note1 === tag2.contentItems[0]));

                                    console.log("entities.Tag.readAll: " + entities.Tag.readAll);
                                    console.log("entities.Note.readAll: " + entities.Note.readAll);

                                    entities.Tag.readAll(function(tags) {
                                        tags.forEach(function(tag){
                                            console.log("read tag: " + JSON.stringify(tag.toPojo()));
                                        });
                                    });
                                })
                            });
                        });
                    });
                });
            });
        });

    }

    function testCRUD4() {

        // this is for testing recursion vs. iteration for datasource access
        var count = 0;
        var total = 1;

        while (count < total) {
            count++;

            var tag1 = new entities.Tag("tag1");
            var tag2 = new entities.Tag("tag2");
            var tag3 = new entities.Tag("tag3");
            var tag4 = new entities.Tag("tag4");
            var tag5 = new entities.Tag("tag5");

            var tags = [tag1, tag2, tag3, tag4, tag5];

            var note1 = new entities.Note("lorem ipsum");
            var note2 = new entities.Note("irem lopsum");

            tag1.create(function () {
                tag2.create(function () {
                    tag3.create(function () {
                        tag4.create(function () {
                            tag5.create(function () {
                                // add tag1-tag3
                                note1.addTag(tag1);
                                note1.addTag(tag2);
                                note1.addTag(tag3);
                                // remove tag1 before create
                                note1.removeTag(tag1);
                                console.info("before create note1: " + JSON.stringify(note1.toPojo()));
                                note1.create(function () {
                                    console.log("after create note1");
                                    note2.addTag(tag2);
                                    note2.addTag(tag3);
                                    note2.addTag(tag5);
                                    note2.create(function() {
                                        console.log("after create note2");
                                        EntityManager.resetEntities("Tag");
                                        EntityManager.resetEntities("Note");
                                        entities.Tag.readAll(function (tags) {
                                            tags.forEach(function (tag) {
                                                console.info("after create: read tag: " + JSON.stringify(tag.toPojo()));
                                            });
                                            entities.Note.read(note2._id,function(){
                                                entities.Note.read(note1._id, function (note) {
                                                    console.info("after create:  read note1: " + JSON.stringify(note.toPojo()));
                                                    // add tag4 and remove tag3
                                                    note1.removeTag(tag3);
                                                    note1.removeTag(tag2);
                                                    note1.addTag(tag4);
                                                    note1.addTag(tag1);
                                                    note1.addTag(tag5);
                                                    // call update
                                                    note1.update(function () {
                                                        console.info("after update, before delete of tag5: note1: " + JSON.stringify(note1.toPojo()) + ", tags: " + note1.tags);
                                                        console.info("after update, before delete of tag5: note2: " + JSON.stringify(note2.toPojo()) + ", tags: " + note1.tags);
                                                        // we delete tag5
                                                        tag5.delete(function(){
                                                            console.log("after delete of tag5, note1: " + JSON.stringify(note1.toPojo()));
                                                            console.log("after delete of tag5, note2: " + JSON.stringify(note2.toPojo()));
                                                            EntityManager.resetEntities("Tag");
                                                            EntityManager.resetEntities("Note");
                                                            // iterate over the tags
                                                            entities.Tag.readAll(function (tags) {
                                                                var countdown = tags.length;
                                                                tags.forEach(function (tag) {
                                                                    console.info("after update, after reset: read tag: " + JSON.stringify(tag.toPojo()));
                                                                    console.info("before eagerload(): read associated entities for tag" + tag._id + ": " + tag.contentItems.length + ", loaded is: " + tag.contentItems.loaded);
                                                                    tag.contentItems.load(function(){
                                                                        console.info("after eagerload: loading of associated entities done for tag " + tag._id + ": " + tag.contentItems.length + ", loaded is: " + tag.contentItems.loaded);
                                                                        countdown--;
                                                                        if (countdown == 0) {
                                                                            entities.Note.read(note1._id, function (note) {
                                                                                console.info("after update, after reset(): note1: " + JSON.stringify(note.toPojo()));

                                                                                // now delete the entity and check whether references will be removed from bidirectionally associated entities
                                                                                note.delete(function(){
                                                                                    console.log("delete() done. Checking formerly associated entities...");
                                                                                    tags.forEach(function (tag) {
                                                                                        console.info("after delete: read tag: " + JSON.stringify(tag.toPojo()));
                                                                                    });
                                                                                    entities.Note.readAll(function(notes){
                                                                                        notes.forEach(function(note){
                                                                                            console.info("finally, read note: " + JSON.stringify(note.toPojo()))
                                                                                        });
                                                                                    });
                                                                                });
                                                                            });
                                                                        }
                                                                    })
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }

    }

    return {
        test: test
    }

});