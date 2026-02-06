/**
 * Feedback Analytics Module
 * 
 * Provides basic analytics for feedback data:
 * - Query feedback by type
 * - Detect spikes in feedback volume
 * - Group feedback by patterns
 */

const { getAllFeedback, getFeedbackByType, getFeedbackCount } = require('./database/db');

// Constants
const MAX_PREVIEW_LENGTH = 100; // Maximum length for text preview in admin display
const DEFAULT_FEEDBACK_LIMIT = 100; // Default limit for feedback queries

/**
 * Get feedback statistics summary
 */
function getFeedbackSummary(days = 7) {
  try {
    const allFeedback = getAllFeedback(1000);
    
    // Filter feedback by days
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - days);
    
    const recentFeedback = allFeedback.filter(f => 
      new Date(f.created_at) >= cutoffTime
    );
    
    // Count by type
    const typeCounts = {
      bug: 0,
      unclear: 0,
      idea: 0,
      total: recentFeedback.length
    };
    
    recentFeedback.forEach(f => {
      if (typeCounts[f.feedback_type] !== undefined) {
        typeCounts[f.feedback_type]++;
      }
    });
    
    return {
      period: `Last ${days} days`,
      counts: typeCounts,
      feedback: recentFeedback
    };
  } catch (error) {
    console.error('Error getting feedback summary:', error);
    return null;
  }
}

/**
 * Detect spike in feedback (compared to average)
 * Returns true if current rate is significantly higher than average
 */
function detectFeedbackSpike(windowMinutes = 60, thresholdMultiplier = 3) {
  try {
    const recentCount = getFeedbackCount(windowMinutes);
    const dayCount = getFeedbackCount(24 * 60);
    
    // Calculate average per hour over last day
    const avgPerHour = dayCount / 24;
    
    // Calculate current rate per hour
    const currentRate = (recentCount / windowMinutes) * 60;
    
    // Detect spike if current rate is significantly higher than average
    const isSpike = currentRate >= avgPerHour * thresholdMultiplier;
    
    return {
      isSpike,
      currentRate: currentRate.toFixed(2),
      averageRate: avgPerHour.toFixed(2),
      recentCount,
      windowMinutes,
      threshold: (avgPerHour * thresholdMultiplier).toFixed(2)
    };
  } catch (error) {
    console.error('Error detecting feedback spike:', error);
    return { isSpike: false, error: error.message };
  }
}

/**
 * Get grouped feedback by type for admin review
 */
function getGroupedFeedback(limit = DEFAULT_FEEDBACK_LIMIT) {
  try {
    const bugs = getFeedbackByType('bug', limit);
    const unclear = getFeedbackByType('unclear', limit);
    const ideas = getFeedbackByType('idea', limit);
    
    return {
      bugs: bugs || [],
      unclear: unclear || [],
      ideas: ideas || [],
      total: (bugs?.length || 0) + (unclear?.length || 0) + (ideas?.length || 0)
    };
  } catch (error) {
    console.error('Error grouping feedback:', error);
    return null;
  }
}

/**
 * Format feedback for admin display
 */
function formatFeedbackForAdmin(feedback) {
  if (!feedback || feedback.length === 0) {
    return 'No feedback available';
  }
  
  let message = '';
  
  feedback.forEach((item, index) => {
    const date = new Date(item.created_at).toLocaleString('uk-UA');
    const username = item.username ? `@${item.username}` : 'Anonymous';
    const type = {
      bug: '🐞',
      unclear: '🤔',
      idea: '💡'
    }[item.feedback_type] || '❓';
    
    message += `\n${index + 1}. ${type} ${username} (${date})\n`;
    message += `   ${item.feedback_text.substring(0, MAX_PREVIEW_LENGTH)}${item.feedback_text.length > MAX_PREVIEW_LENGTH ? '...' : ''}\n`;
  });
  
  return message;
}

/**
 * Check if there are critical issues (many bug reports)
 */
function checkCriticalIssues(windowMinutes = 60, threshold = 5) {
  try {
    const allFeedback = getAllFeedback(1000);
    
    // Filter to recent bug reports
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - windowMinutes);
    
    const recentBugs = allFeedback.filter(f => 
      f.feedback_type === 'bug' && 
      new Date(f.created_at) >= cutoffTime
    );
    
    const isCritical = recentBugs.length >= threshold;
    
    return {
      isCritical,
      bugCount: recentBugs.length,
      threshold,
      windowMinutes,
      bugs: isCritical ? recentBugs : []
    };
  } catch (error) {
    console.error('Error checking critical issues:', error);
    return { isCritical: false, error: error.message };
  }
}

module.exports = {
  getFeedbackSummary,
  detectFeedbackSpike,
  getGroupedFeedback,
  formatFeedbackForAdmin,
  checkCriticalIssues
};
