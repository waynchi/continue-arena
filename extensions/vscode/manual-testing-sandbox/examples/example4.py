def order_by_points(nums):
    isNeg = False
    if nums < 0:
        isNeg = True
        nums *= -1
    nums = [int(x) for x in str(nums)]
