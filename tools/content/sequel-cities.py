"""Closed, traversable city layouts for the sequel's siege battles."""
def build_city(grid, units, slug):
    for row in grid:
        for x, cell in enumerate(row):
            if cell in ('#','P','G','V','F','~','b'): row[x] = '.'
    # West assault gate plus a southern flanking gate; walls form one enclosure.
    left, right, top, bottom = 9, 26, 2, 17
    if slug in ('nanjun','fancheng','jianye'):
        left=10
        for y in range(len(grid)):
            for x in (7,8): grid[y][x]='b' if 7<=y<=11 else '~'
    for y in range(top, bottom+1):
        for x in range(left, right+1):
            grid[y][x] = '#' if x in (left,right) or y in (top,bottom) else 'P'
    # Open, roofless wall gaps, not closed gate sprites on traversable cells.
    for y in range(8,12): grid[y][left] = 'P'
    for x in range(17,21): grid[bottom][x] = 'P'
    occupied=set()
    for u in units:
        point=(u['x'],u['y'])
        if grid[point[1]][point[0]]=='#' or point in occupied:
            candidates=[(x,y) for y in range(top+1,bottom) for x in range(left+1,right) if grid[y][x]!='#' and (x,y) not in occupied]
            point=min(candidates,key=lambda p:abs(p[0]-u['x'])+abs(p[1]-u['y']))
            u['x'],u['y']=point
        occupied.add(point)
    return {'left':left,'right':right,'top':top,'bottom':bottom,'westGate':[left,8,4],'southGate':[17,bottom,4]}
