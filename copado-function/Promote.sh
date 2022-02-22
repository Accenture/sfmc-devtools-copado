git_depth=${git_depth:-100}  # set a default git depth of 100 commits
merge_strategy=${merge_strategy-theirs} # set default merge strategy to ours (only if unset)
if [ -n "$merge_strategy" ]; then merge_strategy_option=(-X "$merge_strategy"); else merge_strategy_option=(); fi

echo "promotion branch: $promotion"
echo "merge strategy: $merge_strategy"
echo "user stories: $user_stories"
echo "git_depth: $git_depth"

copado --progress "fetching $target_branch"
copado-git-get --depth "$git_depth" "$target_branch"
copado-git-get --depth "$git_depth" --create "$promotion"
branches=$(echo "$user_stories" | jq -c -r '.[]')
for user_story in ${branches[@]}; do
    echo "merging $user_story"
    copado-git-get --depth "$git_depth" "$user_story"
    git checkout "$promotion"
    git merge "${merge_strategy_option[@]}" -m "auto resolved $user_story win over $promotion" "$user_story"
done

copado --progress "pushing $promotion $tag"

if [ -n "$tag" ]; then
    git tag "$tag"
    git push --atomic origin "$promotion" "$tag"
else
    echo "not tag specified"
    git push origin "$promotion"
fi
