/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
APP.Main = (function() {

  var LAZY_LOAD_THRESHOLD = 300;

  var stories = null;
  var storyStart = 0;
  var count = 100;
  var main = document.querySelector('main');
  var inDetails = false;
  var storyLoadCount = 0;
  var localeData = {
    data: {
      intl: {
        locales: 'en-US'
      }
    }
  };

  var tmplStory = document.querySelector('#tmpl-story').textContent;
  var tmplStoryDetails = document.querySelector('#tmpl-story-details').textContent;
  var tmplStoryDetailsComment = document.querySelector('#tmpl-story-details-comment').textContent;
  var storyDetails = null;
  if (typeof HandlebarsIntl !== 'undefined') {
    HandlebarsIntl.registerWith(Handlebars);
  } else {

    // Remove references to formatRelative, because Intl isn't supported.
    var intlRelative = /, {{ formatRelative time }}/;
    tmplStory = tmplStory.replace(intlRelative, '');
    tmplStoryDetails = tmplStoryDetails.replace(intlRelative, '');
    tmplStoryDetailsComment = tmplStoryDetailsComment.replace(intlRelative, '');
  }

  var storyTemplate =
      Handlebars.compile(tmplStory);
  var storyDetailsTemplate =
      Handlebars.compile(tmplStoryDetails);
  var storyDetailsCommentTemplate =
      Handlebars.compile(tmplStoryDetailsComment);

  /**
   * As every single story arrives in shove its
   * content in at that exact moment. Feels like something
   * that should really be handled more delicately, and
   * probably in a requestAnimationFrame callback.
   */
  function onStoryData (key, details) {

    // This seems odd. Surely we could just select the story
    // directly rather than looping through all of them.
    var storyElements = document.querySelectorAll('.story');

    for (var i = 0; i < storyElements.length; i++) {

      if (storyElements[i].getAttribute('id') === 's-' + key) {

        details.time *= 1000;
        var story = storyElements[i];
        var html = storyTemplate(details);
        story.innerHTML = html;
        story.addEventListener('click', onStoryClick.bind(this, details));
        story.classList.add('clickable');

        // Tick down. When zero we can batch in the next load.
        storyLoadCount--;

      }
    }

    // Colorize on complete.
    if (storyLoadCount === 0)
      colorizeAndScaleStories();
  }

  function onStoryClick(details) {
    requestAnimationFrame(() => {

      if (!storyDetails) {
        storyDetails = document.createElement('section');
        storyDetails.classList.add('story-details');
        storyDetails.style.transform = 'translate3d(100%, 0, 0)';
      }
      storyDetails.setAttribute('id', 'sd-' + details.id);
      

      if (details.url)
        details.urlobj = new URL(details.url);

      var comment;
      var commentsElement;
      var storyHeader;
      var storyContent;

      var storyDetailsHtml = storyDetailsTemplate(details);
      var kids = details.kids;
      var commentHtml = storyDetailsCommentTemplate({
        by: '', text: 'Loading comment...'
      });

      storyDetails.innerHTML = storyDetailsHtml;

      document.body.appendChild(storyDetails);

      commentsElement = storyDetails.querySelector('.js-comments');
      storyHeader = storyDetails.querySelector('.js-header');
      storyContent = storyDetails.querySelector('.js-content');

      var closeButton = storyDetails.querySelector('.js-close');
      closeButton.addEventListener('click', hideStory.bind(this, details.id));

      var headerHeight = storyHeader.getBoundingClientRect().height;
      storyContent.style.paddingTop = headerHeight + 'px';

      if (typeof kids === 'undefined')
        return;

      for (var k = 0; k < kids.length; k++) {

        comment = document.createElement('aside');
        comment.setAttribute('id', 'sdc-' + kids[k]);
        comment.classList.add('story-details__comment');
        comment.innerHTML = commentHtml;
        commentsElement.appendChild(comment);

        // Update the comment with the live data.
        APP.Data.getStoryComment(kids[k], function(commentDetails) {

          commentDetails.time *= 1000;

          var comment = commentsElement.querySelector(
              '#sdc-' + commentDetails.id);
          comment.innerHTML = storyDetailsCommentTemplate(
              commentDetails,
              localeData);
        });
      }
      
      showStory(details.id);
    });    
  }

  function showStory(id) {

    if (inDetails)
      return;

    if (!storyDetails)
      return;

    inDetails = true;    
      
    var storyElements = document.querySelectorAll('.story');
    let storyElementsWithNewStyle = [];
    storyElements.forEach(story => {
      const bodyHeight = document.body.getBoundingClientRect().height;
      // out of the view, don't need any visual change
      if (story.getBoundingClientRect().bottom < 0 || story.getBoundingClientRect().top > bodyHeight)
        return;
      storyElementsWithNewStyle.push(story);
    });
    storyElementsWithNewStyle.forEach(story => {
      story.classList.add('score--details-active')
      var title = story.querySelector('.story__title').classList.add('story__title--details-active');
      var by = story.querySelector('.story__by').classList.add('story__by--details-active');
      var score = story.querySelector('.story__score').classList.add('story__score--details-active');
    });
    storyDetails.style.opacity = 1;

    requestAnimationFrame(() => {
      storyDetails.style.transform = 'translate3d(0, 0, 0)';
    });
  }

  function hideStory(id) {
    requestAnimationFrame(() => {
      if (!inDetails)
        return;
      
      inDetails = false;
        
      var storyElements = document.querySelectorAll('.story');
      // Remove the class from every element because if the user changes the view port while the
      // details dialog is active, some story items can get details-active modifier stuck in their classList
      storyElements.forEach(story => {
        story.classList.remove('story--details-active')
        var title = story.querySelector('.story__title').classList.remove('story__title--details-active');
        var by = story.querySelector('.story__by').classList.remove('story__by--details-active');
        var score = story.querySelector('.story__score').classList.remove('story__score--details-active');
      });

      storyDetails.style.opacity = 0;
      storyDetails.style.transform = 'translate3d(100%, 0, 0)';
    });

  }

  /**
   * Does this really add anything? Can we do this kind
   * of work in a cheaper way?
   */
  function colorizeAndScaleStories() {

    var storyElements = document.querySelectorAll('.story');
    let storyElementsWithNewStyle = []

    // Calculate style changes before changing any element to avoid style invalidation
    storyElements.forEach(story => {
      const bodyHeight = document.body.getBoundingClientRect().height;
      // out of the view, don't need any visual change
      if (story.getBoundingClientRect().bottom < 0 || story.getBoundingClientRect().top > bodyHeight)
        return;

      var score = story.querySelector('.story__score');
      var title = story.querySelector('.story__title');

      // Base the scale on the y position of the score.
      var height = main.offsetHeight;
      var mainPosition = main.getBoundingClientRect();
      var scoreLocation = score.getBoundingClientRect().top -
          document.body.getBoundingClientRect().top;
      var scale = Math.min(1, 1 - (0.05 * ((scoreLocation - 170) / height)));
      var opacity = Math.min(1, 1 - (0.5 * ((scoreLocation - 170) / height)));

      // Now figure out how wide it is and use that to saturate it.
      scoreLocation = score.getBoundingClientRect();
      var saturation = (100 * ((scoreLocation.width - 38) / 2));

      storyElementsWithNewStyle.push({ elem: story, scale, saturation, opacity })
    });
    // Apply all batched changes for better performance
    storyElementsWithNewStyle.forEach((story, index) => {
      const { elem, scale, saturation, opacity } = story;
      var score = elem.querySelector('.story__score');
      var title = elem.querySelector('.story__title');
      score.style.transform = `scale(${scale})`;      
      score.style.backgroundColor = 'hsl(42, ' + saturation + '%, 50%)';
      title.style.opacity = opacity;
    });
  }


  main.addEventListener('scroll', function() {
    requestAnimationFrame(() => {
      var header = document.querySelector('header');
      var headerTitles = header.querySelector('.header__title-wrapper');
      var scrollTopCapped = Math.min(70, main.scrollTop);
      var scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';

      colorizeAndScaleStories();

      header.style.height = (156 - scrollTopCapped) + 'px';
      headerTitles.style.webkitTransform = scaleString;
      headerTitles.style.transform = scaleString;

      // Add a shadow to the header.
      if (main.scrollTop > 70)
        document.body.classList.add('raised');
      else
        document.body.classList.remove('raised');

      // Check if we need to load the next batch of stories.
      var loadThreshold = (main.scrollHeight - main.offsetHeight -
          LAZY_LOAD_THRESHOLD);
      if (main.scrollTop > loadThreshold)
        loadStoryBatch();
    });    
  });

  function loadStoryBatch() {

    if (storyLoadCount > 0)
      return;

    storyLoadCount = count;

    var end = storyStart + count;
    for (var i = storyStart; i < end; i++) {

      if (i >= stories.length)
        return;

      var key = String(stories[i]);
      var story = document.createElement('div');
      story.setAttribute('id', 's-' + key);
      story.classList.add('story');
      story.innerHTML = storyTemplate({
        title: '...',
        score: '-',
        by: '...',
        time: 0
      });
      main.appendChild(story);

      APP.Data.getStoryById(stories[i], onStoryData.bind(this, key));
    }

    storyStart += count;

  }

  // Bootstrap in the stories.
  APP.Data.getTopStories(function(data) {
    stories = data;
    loadStoryBatch();
    main.classList.remove('loading');
  });

})();
