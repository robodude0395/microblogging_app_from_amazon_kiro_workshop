# Post Comments Feature - Verification Guide

## Overview
This guide will help you manually verify that the post-comments feature is working correctly in the deployed application.

## Prerequisites
- The application should be deployed and accessible
- You need a user account (create one if you don't have it)
- Frontend URL: Check your CloudFront distribution or S3 static website URL

## Verification Steps

### 1. Test Creating a Comment

**Steps:**
1. Open the application in your browser
2. Log in with your credentials
3. Navigate to the Feed page
4. Find any post (or create a new one if the feed is empty)
5. Look for the comment section below the post
6. Click to expand the comments (if collapsed)
7. Type a test comment in the input field (e.g., "This is a test comment!")
8. Click the submit/post button

**Expected Results:**
- ✅ The comment input field should be visible when logged in
- ✅ The submit button should disable during submission
- ✅ After submission, the input field should clear
- ✅ Your new comment should appear in the comment list immediately
- ✅ The comment should show your username and a timestamp
- ✅ The comment count badge should increment by 1

**Failure Indicators:**
- ❌ Error message appears
- ❌ Comment doesn't appear after submission
- ❌ Input field doesn't clear
- ❌ Comment count doesn't update

---

### 2. Test Viewing Comments on a Post

**Steps:**
1. Stay on the Feed page with the post you just commented on
2. Refresh the page (to verify persistence)
3. Expand the comments section if it's collapsed
4. Observe the comments displayed

**Expected Results:**
- ✅ All comments for the post are displayed
- ✅ Comments are sorted chronologically (oldest first)
- ✅ Each comment shows:
  - Username (clickable link to profile)
  - Comment text
  - Relative timestamp (e.g., "2 minutes ago")
- ✅ Your comment from step 1 is still visible after refresh
- ✅ Comment count badge shows the correct number

**Failure Indicators:**
- ❌ Comments don't load
- ❌ "Failed to load comments" error appears
- ❌ Comments are in wrong order
- ❌ Missing username or timestamp
- ❌ Comment disappeared after refresh

---

### 3. Test Deleting Own Comment

**Steps:**
1. Find the comment you created in step 1
2. Look for a delete button next to your comment
3. Click the delete button
4. Observe the UI update

**Expected Results:**
- ✅ Delete button is visible ONLY on your own comments
- ✅ Delete button is NOT visible on other users' comments
- ✅ After clicking delete, the comment disappears from the list
- ✅ The comment count badge decrements by 1
- ✅ No error message appears

**Failure Indicators:**
- ❌ Delete button appears on other users' comments
- ❌ Delete button doesn't appear on your own comment
- ❌ "Failed to delete comment" error appears
- ❌ Comment doesn't disappear after deletion
- ❌ Comment count doesn't update

---

### 4. Verify Comment Count Updates Correctly

**Steps:**
1. Find a post with 0 comments (or create a new post)
2. Note the initial comment count (should be 0)
3. Add a comment to the post
4. Observe the comment count
5. Add another comment
6. Observe the comment count again
7. Delete one of your comments
8. Observe the comment count
9. Refresh the page
10. Verify the comment count persists

**Expected Results:**
- ✅ Initial count: 0
- ✅ After first comment: 1
- ✅ After second comment: 2
- ✅ After deleting one: 1
- ✅ After refresh: Still 1 (persisted correctly)
- ✅ Count updates happen immediately without page refresh

**Failure Indicators:**
- ❌ Count doesn't update after adding comment
- ❌ Count doesn't update after deleting comment
- ❌ Count is incorrect after refresh
- ❌ Count shows wrong number

---

## Additional Tests (Optional)

### Test Authentication Requirements

**Steps:**
1. Log out of the application
2. View the Feed page
3. Observe the comment sections

**Expected Results:**
- ✅ Comments are still visible (read access doesn't require auth)
- ✅ Comment input field is NOT visible when logged out
- ✅ Delete buttons are NOT visible when logged out

---

### Test Comment Validation

**Steps:**
1. Log in
2. Try to submit an empty comment (just spaces)
3. Try to submit a very long comment (>500 characters)

**Expected Results:**
- ✅ Empty comment is rejected with validation error
- ✅ Comment over 500 characters is rejected with validation error
- ✅ Error messages are clear and helpful

---

## Browser Console Verification

Open the browser developer console (F12) and check:

1. **Network Tab:**
   - POST `/posts/{postId}/comments` returns 201 when creating
   - GET `/posts/{postId}/comments` returns 200 when fetching
   - DELETE `/comments/{commentId}` returns 200 when deleting

2. **Console Tab:**
   - No JavaScript errors appear during comment operations
   - No CORS errors appear

---

## Troubleshooting

### Comments Don't Load
- Check browser console for errors
- Verify API Gateway routes are deployed
- Check Lambda function logs in CloudWatch

### Can't Create Comments
- Verify you're logged in
- Check authentication token is being sent
- Verify createComment Lambda has correct permissions

### Can't Delete Comments
- Verify you're the comment author
- Check authentication token is valid
- Verify deleteComment Lambda has correct permissions

### Comment Count Wrong
- Check if PostsTable updates are failing
- Look for Lambda errors in CloudWatch
- Verify DynamoDB permissions

---

## Success Criteria

The deployment is verified successful if:
- ✅ All 4 main verification steps pass
- ✅ No errors appear in browser console
- ✅ API calls return correct status codes
- ✅ Data persists after page refresh
- ✅ Authorization works correctly (only authors can delete)

---

## API Endpoint Reference

For manual API testing (using curl or Postman):

```bash
# Get comments for a post (no auth required)
GET https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod/posts/{postId}/comments

# Create a comment (requires auth)
POST https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod/posts/{postId}/comments
Headers: Authorization: Bearer {token}
Body: { "text": "Your comment text" }

# Delete a comment (requires auth, must be author)
DELETE https://6bvgzz5vri.execute-api.us-east-1.amazonaws.com/prod/comments/{commentId}
Headers: Authorization: Bearer {token}
```

---

## Next Steps

After verification:
1. Mark task 15.4 as complete in tasks.md
2. Document any issues found
3. If all tests pass, the post-comments feature is ready for use!
